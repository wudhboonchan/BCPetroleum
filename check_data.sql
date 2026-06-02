
SELECT 
    dr.date, 
    dr.net_cash_sales, 
    dr.bank_transfer_amount,
    at.id as transaction_id, 
    at.amount, 
    at.transaction_type,
    at.source
FROM daily_cash_records dr
LEFT JOIN account_transactions at ON dr.date = at.date 
    AND (
        (at.transaction_type = 'cash_sales' AND at.amount = dr.net_cash_sales) OR
        (at.transaction_type = 'transfer_sales' AND at.amount = dr.bank_transfer_amount)
    )
WHERE at.id IS NOT NULL
LIMIT 5;

