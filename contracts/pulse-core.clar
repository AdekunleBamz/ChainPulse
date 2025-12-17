;; ChainPulse Core Contract
;; A Chainhook-powered activity tracker that generates fees
;; Built for Stacks Builder Challenge Week 2 - Chainhooks Integration

;; ===============================
;; Constants
;; ===============================

(define-constant CONTRACT_OWNER tx-sender)
(define-constant ERR_UNAUTHORIZED (err u100))
(define-constant ERR_ALREADY_CHECKED_IN (err u101))
(define-constant ERR_INVALID_ACTION (err u102))
(define-constant ERR_INSUFFICIENT_BALANCE (err u103))
(define-constant ERR_COOLDOWN_ACTIVE (err u104))

;; Fee amounts in microSTX
(define-constant PULSE_FEE u1000) ;; 0.001 STX per pulse
(define-constant BOOST_FEE u5000) ;; 0.005 STX for boost action
(define-constant STREAK_BONUS_MULTIPLIER u2)

;; Cooldown period (in blocks, ~10 minutes)
(define-constant PULSE_COOLDOWN u6)

;; ===============================
;; Data Variables
;; ===============================

(define-data-var total-pulses uint u0)
(define-data-var total-fees-collected uint u0)
(define-data-var contract-enabled bool true)

;; ===============================
;; Data Maps
;; ===============================

;; User activity tracking
(define-map user-stats
  principal
  {
    total-pulses: uint,
    current-streak: uint,
    longest-streak: uint,
    total-points: uint,
    last-pulse-block: uint,
    boosts-used: uint
  }
)

;; Daily check-in tracking
(define-map daily-checkin
  { user: principal, day: uint }
  { checked-in: bool, points-earned: uint }
)

;; Activity log for chainhook indexing
(define-map activity-log
  { user: principal, activity-id: uint }
  {
    action-type: (string-ascii 20),
    points: uint,
    fee-paid: uint,
    block-height: uint
  }
)

;; User activity counter
(define-map user-activity-count principal uint)

;; ===============================
;; Private Functions
;; ===============================

(define-private (get-user-stats-or-default (user principal))
  (default-to
    {
      total-pulses: u0,
      current-streak: u0,
      longest-streak: u0,
      total-points: u0,
      last-pulse-block: u0,
      boosts-used: u0
    }
    (map-get? user-stats user)
  )
)

(define-private (calculate-day-number)
  (/ burn-block-height u144) ;; ~144 blocks per day
)

(define-private (increment-activity-count (user principal))
  (let ((current-count (default-to u0 (map-get? user-activity-count user))))
    (map-set user-activity-count user (+ current-count u1))
    (+ current-count u1)
  )
)

;; ===============================
;; Public Functions
;; ===============================

;; Main pulse action - sends a "pulse" and pays fee
;; This is the primary fee-generating function
(define-public (send-pulse)
  (let (
    (user tx-sender)
    (stats (get-user-stats-or-default user))
    (last-pulse (get last-pulse-block stats))
    (blocks-since-last (- burn-block-height last-pulse))
  )
    ;; Check cooldown
    (asserts! (or (is-eq last-pulse u0) (>= blocks-since-last PULSE_COOLDOWN)) ERR_COOLDOWN_ACTIVE)
    
    ;; Transfer fee to contract
    (try! (stx-transfer? PULSE_FEE user (as-contract tx-sender)))
    
    ;; Calculate points (streak bonus if within ~2 days)
    (let (
      (new-streak (if (<= blocks-since-last u288) (+ (get current-streak stats) u1) u1))
      (streak-bonus (if (> new-streak u1) (* (- new-streak u1) STREAK_BONUS_MULTIPLIER) u0))
      (base-points u10)
      (total-earned (+ base-points streak-bonus))
      (activity-id (increment-activity-count user))
    )
      ;; Update user stats
      (map-set user-stats user {
        total-pulses: (+ (get total-pulses stats) u1),
        current-streak: new-streak,
        longest-streak: (if (> new-streak (get longest-streak stats)) new-streak (get longest-streak stats)),
        total-points: (+ (get total-points stats) total-earned),
        last-pulse-block: burn-block-height,
        boosts-used: (get boosts-used stats)
      })
      
      ;; Log activity for chainhook indexing
      (map-set activity-log { user: user, activity-id: activity-id } {
        action-type: "pulse",
        points: total-earned,
        fee-paid: PULSE_FEE,
        block-height: burn-block-height
      })
      
      ;; Update global stats
      (var-set total-pulses (+ (var-get total-pulses) u1))
      (var-set total-fees-collected (+ (var-get total-fees-collected) PULSE_FEE))
      
      ;; Emit print event for chainhook
      (print {
        event: "pulse-sent",
        user: user,
        points: total-earned,
        streak: new-streak,
        fee: PULSE_FEE,
        total-pulses: (var-get total-pulses)
      })
      
      (ok {
        points-earned: total-earned,
        new-streak: new-streak,
        total-points: (+ (get total-points stats) total-earned)
      })
    )
  )
)

;; Boost action - premium fee for bonus points
(define-public (send-boost)
  (let (
    (user tx-sender)
    (stats (get-user-stats-or-default user))
    (activity-id (increment-activity-count user))
    (boost-points u50)
  )
    ;; Transfer boost fee
    (try! (stx-transfer? BOOST_FEE user (as-contract tx-sender)))
    
    ;; Update stats
    (map-set user-stats user (merge stats {
      total-points: (+ (get total-points stats) boost-points),
      boosts-used: (+ (get boosts-used stats) u1)
    }))
    
    ;; Log activity
    (map-set activity-log { user: user, activity-id: activity-id } {
      action-type: "boost",
      points: boost-points,
      fee-paid: BOOST_FEE,
      block-height: burn-block-height
    })
    
    (var-set total-fees-collected (+ (var-get total-fees-collected) BOOST_FEE))
    
    ;; Emit event for chainhook
    (print {
      event: "boost-activated",
      user: user,
      points: boost-points,
      fee: BOOST_FEE,
      total-boosts: (get boosts-used stats)
    })
    
    (ok { points-earned: boost-points, total-points: (+ (get total-points stats) boost-points) })
  )
)

;; Daily check-in (free action, tracks engagement)
(define-public (daily-checkin-action)
  (let (
    (user tx-sender)
    (day (calculate-day-number))
    (checkin-key { user: user, day: day })
    (stats (get-user-stats-or-default user))
    (activity-id (increment-activity-count user))
    (checkin-points u5)
  )
    ;; Check if already checked in today
    (asserts! (is-none (map-get? daily-checkin checkin-key)) ERR_ALREADY_CHECKED_IN)
    
    ;; Record check-in
    (map-set daily-checkin checkin-key { checked-in: true, points-earned: checkin-points })
    
    ;; Update points
    (map-set user-stats user (merge stats {
      total-points: (+ (get total-points stats) checkin-points)
    }))
    
    ;; Log activity
    (map-set activity-log { user: user, activity-id: activity-id } {
      action-type: "checkin",
      points: checkin-points,
      fee-paid: u0,
      block-height: burn-block-height
    })
    
    ;; Emit event for chainhook
    (print {
      event: "daily-checkin",
      user: user,
      day: day,
      points: checkin-points
    })
    
    (ok { day: day, points-earned: checkin-points })
  )
)

;; Mega pulse - high-value action for power users
(define-public (send-mega-pulse (multiplier uint))
  (let (
    (user tx-sender)
    (stats (get-user-stats-or-default user))
    (capped-multiplier (if (> multiplier u10) u10 multiplier))
    (total-fee (* PULSE_FEE capped-multiplier))
    (total-points (* u10 capped-multiplier))
    (activity-id (increment-activity-count user))
  )
    ;; Transfer fee
    (try! (stx-transfer? total-fee user (as-contract tx-sender)))
    
    ;; Update stats
    (map-set user-stats user (merge stats {
      total-pulses: (+ (get total-pulses stats) capped-multiplier),
      total-points: (+ (get total-points stats) total-points)
    }))
    
    ;; Log activity
    (map-set activity-log { user: user, activity-id: activity-id } {
      action-type: "mega-pulse",
      points: total-points,
      fee-paid: total-fee,
      block-height: burn-block-height
    })
    
    (var-set total-pulses (+ (var-get total-pulses) capped-multiplier))
    (var-set total-fees-collected (+ (var-get total-fees-collected) total-fee))
    
    ;; Emit event for chainhook
    (print {
      event: "mega-pulse",
      user: user,
      multiplier: capped-multiplier,
      points: total-points,
      fee: total-fee
    })
    
    (ok { points-earned: total-points, pulses-sent: capped-multiplier })
  )
)

;; Challenge action - time-sensitive bonus opportunity
(define-public (complete-challenge (challenge-id uint))
  (let (
    (user tx-sender)
    (stats (get-user-stats-or-default user))
    (challenge-fee (* PULSE_FEE u3))
    (challenge-points u25)
    (activity-id (increment-activity-count user))
  )
    ;; Transfer challenge fee
    (try! (stx-transfer? challenge-fee user (as-contract tx-sender)))
    
    ;; Update stats
    (map-set user-stats user (merge stats {
      total-points: (+ (get total-points stats) challenge-points)
    }))
    
    ;; Log activity
    (map-set activity-log { user: user, activity-id: activity-id } {
      action-type: "challenge",
      points: challenge-points,
      fee-paid: challenge-fee,
      block-height: burn-block-height
    })
    
    (var-set total-fees-collected (+ (var-get total-fees-collected) challenge-fee))
    
    ;; Emit event for chainhook
    (print {
      event: "challenge-completed",
      user: user,
      challenge-id: challenge-id,
      points: challenge-points,
      fee: challenge-fee
    })
    
    (ok { challenge-id: challenge-id, points-earned: challenge-points })
  )
)

;; ===============================
;; Read-Only Functions
;; ===============================

(define-read-only (get-user-profile (user principal))
  (ok (get-user-stats-or-default user))
)

(define-read-only (get-total-pulses)
  (ok (var-get total-pulses))
)

(define-read-only (get-total-fees)
  (ok (var-get total-fees-collected))
)

(define-read-only (get-activity (user principal) (activity-id uint))
  (map-get? activity-log { user: user, activity-id: activity-id })
)

(define-read-only (has-checked-in-today (user principal))
  (is-some (map-get? daily-checkin { user: user, day: (calculate-day-number) }))
)

(define-read-only (get-current-day)
  (ok (calculate-day-number))
)

(define-read-only (get-cooldown-remaining (user principal))
  (let (
    (stats (get-user-stats-or-default user))
    (last-pulse (get last-pulse-block stats))
    (blocks-passed (- burn-block-height last-pulse))
  )
    (if (>= blocks-passed PULSE_COOLDOWN)
      (ok u0)
      (ok (- PULSE_COOLDOWN blocks-passed))
    )
  )
)

;; ===============================
;; Admin Functions
;; ===============================

(define-public (withdraw-fees (amount uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_UNAUTHORIZED)
    (as-contract (stx-transfer? amount tx-sender CONTRACT_OWNER))
  )
)

(define-public (toggle-contract (enabled bool))
  (begin
    (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_UNAUTHORIZED)
    (var-set contract-enabled enabled)
    (ok enabled)
  )
)
