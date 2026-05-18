curl -X POST "http://localhost:8282/api/pagamentos/callback" ^
  -H "Content-Type: application/json" ^
  -d "{\"customer_id\":\"emp_af6174c1b4\", \"status\":\"pago\", \"valor\":199.90, \"transacao_id\":\"tx_simulada_999\"}"
Pause