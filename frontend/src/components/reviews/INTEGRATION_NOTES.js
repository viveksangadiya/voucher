// ─────────────────────────────────────────────────────────────────────────────
// HOW TO INTEGRATE REVIEWS INTO EXISTING PAGES
// ─────────────────────────────────────────────────────────────────────────────


// ══════════════════════════════════════════════════════════════════════════════
// 1. VOUCHER DETAIL PAGE — add SellerReviews below the seller card
//    File: frontend/src/app/vouchers/[id]/page.tsx
// ══════════════════════════════════════════════════════════════════════════════

// At the top, add imports:
import SellerReviews from '@/components/reviews/SellerReviews';

// After the closing </div> of the seller card (the one showing seller name/rating),
// add this below it — still inside the md:col-span-3 column:
/*
  <SellerReviews
    sellerId={voucher.seller_id}
    sellerName={voucher.seller_name}
  />
*/


// ══════════════════════════════════════════════════════════════════════════════
// 2. DASHBOARD PURCHASES TAB — add ReviewButton to each transaction row
//    File: frontend/src/app/dashboard/page.tsx (or wherever purchases tab is)
// ══════════════════════════════════════════════════════════════════════════════

// At the top, add import:
import ReviewButton from '@/components/reviews/ReviewButton';

// Inside your purchases.map(), add ReviewButton at the bottom of each card:
/*
  <ReviewButton
    transactionId={t.id}
    sellerName={t.seller_name}
    voucherTitle={t.voucher_title}
  />
*/


// ══════════════════════════════════════════════════════════════════════════════
// 3. OPTIONAL — show seller rating inline on voucher cards
//    File: wherever you show seller_rating in the voucher list
// ══════════════════════════════════════════════════════════════════════════════

import StarRating from '@/components/reviews/StarRating';

// Replace the manual ⭐ text with:
/*
  <StarRating
    value={parseFloat(voucher.seller_rating || '5')}
    readonly
    size="sm"
  />
*/
