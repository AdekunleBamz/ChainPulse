;; ChainPulse Badge NFT Contract
;; SIP-009 Compliant NFT for achievement badges
;; Minted based on chainhook-tracked milestones

(impl-trait 'SP2PABAF9FTAJYNFZH93XENAJ8FVY99RRM50D2JG9.nft-trait.nft-trait)

(define-constant CONTRACT_OWNER tx-sender)
(define-constant ERR_UNAUTHORIZED (err u300))
(define-constant ERR_NOT_FOUND (err u301))
(define-constant ERR_ALREADY_MINTED (err u302))
(define-constant ERR_TRANSFER_FAILED (err u303))

;; Badge Types
(define-constant BADGE_FIRST_PULSE u1)
(define-constant BADGE_STREAK_WEEK u2)
(define-constant BADGE_STREAK_MONTH u3)
(define-constant BADGE_100_PULSES u4)
(define-constant BADGE_1000_PULSES u5)
(define-constant BADGE_TIER_BRONZE u6)
(define-constant BADGE_TIER_SILVER u7)
(define-constant BADGE_TIER_GOLD u8)
(define-constant BADGE_TIER_PLATINUM u9)
(define-constant BADGE_EARLY_ADOPTER u10)

;; ===============================
;; NFT Definition
;; ===============================

(define-non-fungible-token pulse-badge uint)

;; ===============================
;; Data Variables
;; ===============================

(define-data-var last-token-id uint u0)
(define-data-var base-uri (string-ascii 200) "https://chainpulse.app/api/badge/")

;; ===============================
;; Data Maps
;; ===============================

;; Badge metadata
(define-map badge-metadata
  uint
  {
    badge-type: uint,
    minted-to: principal,
    minted-at: uint,
    milestone-value: uint
  }
)

;; Track which badges a user has earned
(define-map user-badges
  { user: principal, badge-type: uint }
  { token-id: uint, minted-at: uint }
)

;; Badge type definitions
(define-map badge-types
  uint
  {
    name: (string-ascii 50),
    description: (string-ascii 200),
    image-uri: (string-ascii 200),
    total-minted: uint
  }
)

;; ===============================
;; SIP-009 Functions
;; ===============================

(define-read-only (get-last-token-id)
  (ok (var-get last-token-id))
)

(define-read-only (get-token-uri (token-id uint))
  (ok (some (concat (var-get base-uri) "metadata/")))
)

(define-read-only (get-owner (token-id uint))
  (ok (nft-get-owner? pulse-badge token-id))
)

(define-public (transfer (token-id uint) (sender principal) (recipient principal))
  (begin
    (asserts! (is-eq tx-sender sender) ERR_UNAUTHORIZED)
    (match (nft-transfer? pulse-badge token-id sender recipient)
      success (begin
        (print {
          event: "badge-transferred",
          token-id: token-id,
          from: sender,
          to: recipient
        })
        (ok true)
      )
      error ERR_TRANSFER_FAILED
    )
  )
)

;; ===============================
;; Minting Functions
;; ===============================

;; Mint a badge for achieving a milestone
(define-public (mint-badge (badge-type uint) (recipient principal) (milestone-value uint))
  (let (
    (token-id (+ (var-get last-token-id) u1))
    (badge-key { user: recipient, badge-type: badge-type })
  )
    ;; Check if user already has this badge type
    (asserts! (is-none (map-get? user-badges badge-key)) ERR_ALREADY_MINTED)
    
    ;; Mint the NFT
    (try! (nft-mint? pulse-badge token-id recipient))
    
    ;; Store metadata
    (map-set badge-metadata token-id {
      badge-type: badge-type,
      minted-to: recipient,
      minted-at: burn-block-height,
      milestone-value: milestone-value
    })
    
    ;; Track user badge
    (map-set user-badges badge-key {
      token-id: token-id,
      minted-at: burn-block-height
    })
    
    ;; Update badge type stats
    (match (map-get? badge-types badge-type)
      badge-info (map-set badge-types badge-type (merge badge-info {
        total-minted: (+ (get total-minted badge-info) u1)
      }))
      true
    )
    
    ;; Update last token ID
    (var-set last-token-id token-id)
    
    ;; Emit event for chainhook
    (print {
      event: "badge-minted",
      token-id: token-id,
      badge-type: badge-type,
      recipient: recipient,
      milestone: milestone-value
    })
    
    (ok token-id)
  )
)

;; Mint first pulse badge
(define-public (mint-first-pulse-badge)
  (mint-badge BADGE_FIRST_PULSE tx-sender u1)
)

;; Mint streak badges
(define-public (mint-streak-badge (streak-days uint))
  (let (
    (badge-type (if (>= streak-days u30) BADGE_STREAK_MONTH BADGE_STREAK_WEEK))
  )
    (asserts! (or (>= streak-days u7) (>= streak-days u30)) ERR_UNAUTHORIZED)
    (mint-badge badge-type tx-sender streak-days)
  )
)

;; Mint pulse milestone badges
(define-public (mint-pulse-milestone-badge (total-pulses uint))
  (let (
    (badge-type (if (>= total-pulses u1000) BADGE_1000_PULSES BADGE_100_PULSES))
  )
    (asserts! (or (>= total-pulses u100) (>= total-pulses u1000)) ERR_UNAUTHORIZED)
    (mint-badge badge-type tx-sender total-pulses)
  )
)

;; Mint tier achievement badges
(define-public (mint-tier-badge (tier (string-ascii 10)))
  (let (
    (badge-type (if (is-eq tier "platinum")
      BADGE_TIER_PLATINUM
      (if (is-eq tier "gold")
        BADGE_TIER_GOLD
        (if (is-eq tier "silver")
          BADGE_TIER_SILVER
          BADGE_TIER_BRONZE
        )
      )
    ))
  )
    (mint-badge badge-type tx-sender u0)
  )
)

;; ===============================
;; Admin Functions
;; ===============================

(define-public (initialize-badge-type 
  (badge-type uint) 
  (name (string-ascii 50)) 
  (description (string-ascii 200))
  (image-uri (string-ascii 200))
)
  (begin
    (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_UNAUTHORIZED)
    (map-set badge-types badge-type {
      name: name,
      description: description,
      image-uri: image-uri,
      total-minted: u0
    })
    (print {
      event: "badge-type-initialized",
      badge-type: badge-type,
      name: name
    })
    (ok badge-type)
  )
)

(define-public (set-base-uri (new-uri (string-ascii 200)))
  (begin
    (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_UNAUTHORIZED)
    (var-set base-uri new-uri)
    (ok true)
  )
)

;; ===============================
;; Read-Only Functions
;; ===============================

(define-read-only (get-badge-metadata (token-id uint))
  (map-get? badge-metadata token-id)
)

(define-read-only (get-badge-type-info (badge-type uint))
  (map-get? badge-types badge-type)
)

(define-read-only (has-badge (user principal) (badge-type uint))
  (is-some (map-get? user-badges { user: user, badge-type: badge-type }))
)

(define-read-only (get-user-badge (user principal) (badge-type uint))
  (map-get? user-badges { user: user, badge-type: badge-type })
)

(define-read-only (get-total-badges-minted)
  (ok (var-get last-token-id))
)
