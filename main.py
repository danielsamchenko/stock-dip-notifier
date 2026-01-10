import yfinance as yf

df = yf.download("AAPL", start="2026-01-01", interval="1d")
print(df.tail())
