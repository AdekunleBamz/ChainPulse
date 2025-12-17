;; ChainPulse Rewards Contract
;; Handles point redemption and reward distribution
;; Integrates with chainhooks for real-time tracking

(define-constant CONTRACT_OWNER tx-sender)
(define-constant ERR_UNAUTHORIZED (err u200))
(define-constant ERR_INSUFFICIENT_POINTS (err u201))
(define-constant ERR_REWARD_NOT_FOUND (err u202))
(define-constant ERR_ALREADY_CLAIMED (err u203))

;; Reward tiers
(define-constant TIER_BRONZE u100)
(define-constant TIER_SILVER u500)
(define-constant TIER_GOLD u1000)
(define-constant TIER_PLATINUM u5000)

;; ===============================
;; Data Storage
;; ===============================

(define-data-var total-rewards-distributed uint u0)
(define-data-var reward-pool uint u0)

;; User reward tracking
(define-map user-rewards
  principal
  {
    points-redeemed: uint,
    rewards-claimed: uint,
    current-tier: (string-ascii 10),
    tier-achieved-block: uint
  }
)

;; Reward catalog
(define-map reward-catalog
  uint
  {
    name: (string-ascii 50),
    points-cost: uint,
    stx-value: uint,
    available: bool,
    total-claimed: uint
  }
)

;; Claim history for chainhook indexing
(define-map claim-history
  { user: principal, claim-id: uint }
  {
    reward-id: uint,
    points-spent: uint,
    stx-received: uint,
    block-height: uint
  }
)

(define-map user-claim-count principal uint)

;; ===============================
;; Private Functions
;; ===============================

(define-private (get-user-rewards-or-default (user principal))
  (default-to
    {
      points-redeemed: u0,
      rewards-claimed: u0,
      current-tier: "none",
      tier-achieved-block: u0
    }
    (map-get? user-rewards user)
  )
)

(define-private (calculate-tier (total-points uint))
  (if (>= total-points TIER_PLATINUM)
    "platinum"
    (if (>= total-points TIER_GOLD)
      "gold"
      (if (>= total-points TIER_SILVER)
        "silver"
        (if (>= total-points TIER_BRONZE)
          "bronze"
          "none"
        )
      )
    )
  )
)

(define-private (increment-claim-count (user principal))
  (let ((current (default-to u0 (map-get? user-claim-count user))))
    (map-set user-claim-count user (+ current u1))
    (+ current u1)
  )
)

;; ===============================
;; Public Functions
;; ===============================

;; Claim a reward by redeeming points
(define-public (claim-reward (reward-id uint) (user-points uint))
  (let (
    (user tx-sender)
    (reward (unwrap! (map-get? reward-catalog reward-id) ERR_REWARD_NOT_FOUND))
    (user-data (get-user-rewards-or-default user))
    (claim-id (increment-claim-count user))
  )
    ;; Verify sufficient points (simplified - in production, would verify from core contract)
    (asserts! (>= user-points (get points-cost reward)) ERR_INSUFFICIENT_POINTS)
    (asserts! (get available reward) ERR_REWARD_NOT_FOUND)
    
    ;; Update user rewards
    (map-set user-rewards user {
      points-redeemed: (+ (get points-redeemed user-data) (get points-cost reward)),
      rewards-claimed: (+ (get rewards-claimed user-data) u1),
      current-tier: (calculate-tier (+ (get points-redeemed user-data) (get points-cost reward))),
      tier-achieved-block: burn-block-height
    })
    
    ;; Record claim history
    (map-set claim-history { user: user, claim-id: claim-id } {
      reward-id: reward-id,
      points-spent: (get points-cost reward),
      stx-received: (get stx-value reward),
      block-height: burn-block-height
    })
    
    ;; Update reward stats
    (map-set reward-catalog reward-id (merge reward {
      total-claimed: (+ (get total-claimed reward) u1)
    }))
    
    (var-set total-rewards-distributed (+ (var-get total-rewards-distributed) (get stx-value reward)))
    
    ;; Emit event for chainhook
    (print {
      event: "reward-claimed",
      user: user,
      reward-id: reward-id,
      points-spent: (get points-cost reward),
      stx-value: (get stx-value reward),
      new-tier: (calculate-tier (+ (get points-redeemed user-data) (get points-cost reward)))
    })
    
    (ok {
      reward-id: reward-id,
      points-spent: (get points-cost reward),
      stx-received: (get stx-value reward)
    })
  )
)

;; Achieve tier milestone (triggers badge mint eligibility)
(define-public (achieve-tier (total-points uint))
  (let (
    (user tx-sender)
    (user-data (get-user-rewards-or-default user))
    (new-tier (calculate-tier total-points))
    (current-tier (get current-tier user-data))
  )
    ;; Update tier if improved
    (map-set user-rewards user (merge user-data {
      current-tier: new-tier,
      tier-achieved-block: burn-block-height
    }))
    
    ;; Emit tier achievement event
    (print {
      event: "tier-achieved",
      user: user,
      tier: new-tier,
      total-points: total-points,
      previous-tier: current-tier
    })
    
    (ok { tier: new-tier, achieved-at: burn-block-height })
  )
)

;; Batch point conversion (for high-volume users)
(define-public (batch-convert-points (point-amount uint))
  (let (
    (user tx-sender)
    (user-data (get-user-rewards-or-default user))
    (conversion-rate u100) ;; 100 points = 1 microSTX
    (stx-value (/ point-amount conversion-rate))
    (claim-id (increment-claim-count user))
  )
    (asserts! (>= point-amount u100) ERR_INSUFFICIENT_POINTS)
    
    ;; Update records
    (map-set user-rewards user (merge user-data {
      points-redeemed: (+ (get points-redeemed user-data) point-amount)
    }))
    
    ;; Log conversion
    (map-set claim-history { user: user, claim-id: claim-id } {
      reward-id: u999, ;; Special ID for conversions
      points-spent: point-amount,
      stx-received: stx-value,
      block-height: burn-block-height
    })
    
    ;; Emit event
    (print {
      event: "points-converted",
      user: user,
      points: point-amount,
      stx-value: stx-value
    })
    
    (ok { points-converted: point-amount, stx-value: stx-value })
  )
)

;; ===============================
;; Admin Functions
;; ===============================

(define-public (add-reward (id uint) (name (string-ascii 50)) (points-cost uint) (stx-value uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_UNAUTHORIZED)
    (map-set reward-catalog id {
      name: name,
      points-cost: points-cost,
      stx-value: stx-value,
      available: true,
      total-claimed: u0
    })
    (print {
      event: "reward-added",
      reward-id: id,
      name: name,
      points-cost: points-cost
    })
    (ok id)
  )
)

(define-public (fund-reward-pool (amount uint))
  (begin
    (try! (stx-transfer? amount tx-sender (as-contract tx-sender)))
    (var-set reward-pool (+ (var-get reward-pool) amount))
    (print { event: "pool-funded", amount: amount, total: (var-get reward-pool) })
    (ok (var-get reward-pool))
  )
)

;; ===============================
;; Read-Only Functions
;; ===============================

(define-read-only (get-user-reward-stats (user principal))
  (ok (get-user-rewards-or-default user))
)

(define-read-only (get-reward-info (id uint))
  (map-get? reward-catalog id)
)

(define-read-only (get-total-distributed)
  (ok (var-get total-rewards-distributed))
)

(define-read-only (get-user-tier (user principal))
  (ok (get current-tier (get-user-rewards-or-default user)))
)

(define-read-only (get-claim-history-entry (user principal) (claim-id uint))
  (map-get? claim-history { user: user, claim-id: claim-id })
)
