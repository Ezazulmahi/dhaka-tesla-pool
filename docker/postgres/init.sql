-- Runs once, on the first start of an empty volume.
-- The main database comes from POSTGRES_DB; the test suite gets its own database
-- because it truncates tables between tests.
CREATE DATABASE dhaka_tesla_pool_test;
