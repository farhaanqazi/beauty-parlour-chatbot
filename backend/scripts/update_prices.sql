-- ==========================================
-- FINAL PRICE UPDATE & BACKFILL SCRIPT
-- ==========================================

-- 1. UPDATE PRICES IN SALON_SERVICES TABLE
-- ==========================================

-- Bridal Makeup
UPDATE salon_services SET price = 70000, discount_price = NULL WHERE LOWER(name) LIKE '%bridal%';

-- Hair Styling
UPDATE salon_services SET price = 2000, discount_price = NULL WHERE LOWER(name) LIKE '%hair styling%';

-- Party Makeup
UPDATE salon_services SET price = 10000, discount_price = NULL WHERE LOWER(name) LIKE '%party makeup%';

-- Facial Treatment
UPDATE salon_services SET price = 5000, discount_price = NULL WHERE LOWER(name) LIKE '%facial%';

-- Engagement Makeup
UPDATE salon_services SET price = 70000, discount_price = NULL WHERE LOWER(name) LIKE '%engagement%';

-- Manicure
UPDATE salon_services SET price = 1000, discount_price = NULL WHERE LOWER(name) LIKE '%manicure%';

-- Haircut
UPDATE salon_services SET price = 500, discount_price = NULL WHERE LOWER(name) LIKE '%haircut%';

-- Beard Style
UPDATE salon_services SET price = 200, discount_price = NULL WHERE LOWER(name) LIKE '%beard%';


-- 2. BACKFILL APPOINTMENTS WITH NEW PRICES
-- ==========================================

-- This ensures all past appointments reflect the new correct prices
UPDATE appointments a
SET final_price = ss.price
FROM salon_services ss
WHERE a.service_id = ss.id;


-- 3. VERIFICATION QUERY
-- ==========================================

-- Run this to check the new prices
SELECT name, price FROM salon_services ORDER BY name;

-- Run this to check total revenue after update
SELECT SUM(final_price) as total_revenue FROM appointments;
