# AI Global Stock Autotrading System

This project is a sophisticated simulation of an AI-powered, fully automated stock trading dashboard. It focuses on major global semiconductor stocks and demonstrates how different hedge fund strategies can be deployed based on real-time market analysis. The system is powered by the Google Gemini API to make high-level strategic decisions and generate trade signals.

---

## ✨ Core Features

-   **Real-time Market Simulation**: Simulates a live market feed for 6 major semiconductor stocks: Samsung, SK Hynix, NVIDIA, TSMC, Micron, and CXMT (ChangXin Memory).
-   **AI-Powered Engine**: Utilizes the Google Gemini API for multiple AI personas:
    -   **Chief Investment Officer (CIO)**: Analyzes the overall market regime (Trending, Ranging, etc.) and selects the most appropriate high-level hedge fund strategy.
    -   **Quantitative Analyst**: Analyzes individual stocks based on quantitative factors (Value, Momentum, etc.) within the CIO's strategic framework to generate BUY/SELL signals.
    -   **ML Inference Model**: Emulates a time-series machine learning model that uses technical features (RSI, price change, volatility) and a softmax probability output with a confidence threshold to make short-term predictions.
-   **Dynamic Hedge Fund Strategies**:
    -   **Alpha Momentum**: Capitalizes on trending markets.
    -   **Mean Reversion**: Trades on the expectation that prices will revert to their average.
    -   **Pairs Trading (Statistical Arbitrage)**: A market-neutral strategy that trades on the statistical relationship between two correlated stocks (e.g., Micron & SK Hynix).
    -   **Deep Hedging (ML)**: A machine-learning-driven approach for volatile or ranging markets.
    -   **Risk Off**: A safety-first mode that liquidates positions and holds cash.
-   **Comprehensive Portfolio Management**:
    -   Tracks cash and holdings across multiple currencies with real-time exchange rate application.
    -   Full support for **Long**, **Short**, and **Pairs Trade** positions.
    -   Virtual bank account for managing trading capital.
-   **Interactive Data Visualization**:
    -   Normalized performance chart to compare all stocks from a common baseline.
    -   Detailed candlestick charts for each individual stock.
    -   **Live trade markers** (▲ for buy, ▼ for sell) plotted directly on the charts.
-   **Real-time Discord Notifications**: Pushes all AI trade decisions to a Discord channel via webhooks for instant monitoring.
-   **Modern UI/UX**:
    -   Sleek, responsive interface built with Tailwind CSS.
    -   Includes both **Light and Dark modes**.
    -   Real-time logs for all AI decisions and trade activities.

---

## 🛠️ Tech Stack

-   **Frontend**: React, TypeScript
-   **Styling**: Tailwind CSS
-   **Charting**: Recharts
-   **AI**: `@google/genai` for Google Gemini API integration
-   **Simulation**: No external backend; all market data, trade execution, and portfolio logic are simulated in the browser.

---

## 🚀 Getting Started

This application is designed to run in a browser-based development environment where environment variables can be securely managed.

### Prerequisites

You need a Google Gemini API key to run this application.

### Setup

1.  **Environment Variable Configuration**:
    -   The application requires environment variables to function correctly. You must configure these in your deployment or development environment.
    -   **`API_KEY` (Required)**: Your Google Gemini API key.
    -   **`DISCORD_WEBHOOK_URL` (Optional)**: To receive real-time trade alerts in a Discord channel, create a webhook in your Discord server settings and set the URL here. If this is not set, notifications will be skipped without error.

    ```
    # Example for a .env file (if your environment supports it)
    API_KEY="YOUR_GEMINI_API_KEY_HERE"
    DISCORD_WEBHOOK_URL="YOUR_DISCORD_WEBHOOK_URL_HERE"
    ```

2.  **Run the Application**:
    -   Once the environment variables are set, serve the `index.html` file and its associated JavaScript modules. The application will initialize and start running the simulation.

### How to Use

1.  **Start the Engine**: Click the "AutoTrade" toggle to activate the trading engine.
2.  **Select a Mode**:
    -   **적극 투자 (Aggressive Mode)**: Toggling this on allows the AI to trade larger volumes and take on more risk.
    -   **저지연 모드 (Low Latency Mode)**: Toggling this on instructs the AI to provide faster (though potentially less deeply reasoned) responses.
3.  **Observe**: Watch as the AI CIO analyzes the market, selects a strategy, and the trading engine executes trades based on the live data. All activities and decisions are logged in real-time and sent to Discord (if configured).