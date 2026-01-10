import datetime

import yfinance as yf

tickers = ["AAPL", "MSFT", "TSLA"]
big_dip_pct = -5.0


def latest_day_change(df):
    df = df.dropna()
    if len(df) < 2:
        return None
    close = df["Close"]
    if hasattr(close, "columns"):
        close = close.iloc[:, 0]
    last_two = close.tail(2)
    prev_close = float(last_two.iloc[0])
    last_close = float(last_two.iloc[1])
    change_pct = (last_close - prev_close) / prev_close * 100
    day = last_two.index[-1].date()
    return day, change_pct


today = datetime.date.today()

for ticker in tickers:
    df = yf.download(ticker, period="5d", interval="1d", progress=False)
    result = latest_day_change(df)
    if not result:
        print(f"{ticker}: not enough data to check")
        continue
    day, change_pct = result
    if day != today:
        print(f"{ticker}: latest data is {day} ({change_pct:.2f}%)")
    elif change_pct <= big_dip_pct:
        print(f"{ticker}: big dip today ({change_pct:.2f}%)")
    else:
        print(f"{ticker}: no big dip today ({change_pct:.2f}%)")
