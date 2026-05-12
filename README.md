# ⚡ Watthai: Karachi Energy Hub

A comprehensive AI-powered energy management platform designed specifically for the unique electricity ecosystem of Karachi, Pakistan. This app transforms the dreaded monthly K-Electric bill into an actionable insight dashboard and connects the community to track power outages in real-time.

## 🌟 Core Feature Pillars

### 1. 📸 AI-Powered Bill Intelligence
*   **Instant Extraction**: High-precision OCR via Google Cloud Vision that converts photos of K-Electric bills into structured digital data.
*   **Smart Analysis**: Powered by `gemini-2.5-flash` to detect anomalies in Fuel Cost Adjustments (FCA), fixed charges, and consumer categories.
*   **Neighborhood Benchmarking**: Automatically compares your consumption against anonymized zone-based averages to tell you if your usage is normal for your area.

### 2. 💰 Personalized Energy Advisor
*   **Household Profiling**: Integrated onboarding that tracks your home's specific makeup (number of ACs, inverter presence, room count, and residents).
*   **Hyper-Localized Tips**: Generates specific, rupee-denominated savings advice. Instead of "use less power," it gives concrete actions like *"Reducing AC usage by 2 hours in your 3-room house could save you approx. Rs. 1,200 this month."*
*   **Bilingual Support**: All AI-generated advice is delivered in both English and Urdu for maximum accessibility.

### 3. 📢 Community Outage Network
*   **Crowdsourced Reporting**: A real-time outage reporting system where users can flag power failures in their specific zone.
*   **Validation Logic**: The system aggregates reports to verify outages. When a threshold (e.g., 10+ reports) is hit, it validates a zone-wide outage.
*   **Outage Tracking**: Tracks start times and report counts to provide a community-driven map of grid stability.

### 4. 🛠️ User Experience & Accessibility
*   **PWA Enabled**: Works as a Progressive Web App for a seamless mobile experience on Android and iOS.
*   **Internationalization**: Full `next-intl` implementation for a seamless multi-language interface.
*   **Onboarding Flow**: A guided experience to capture home profiles for better AI personalization.

## 🛠️ Technical Architecture

### The Stack
- **Frontend**: Next.js 15 (App Router) + TypeScript
- **Styling**: Tailwind CSS 4.0 + Motion + Radix UI
- **AI Orchestration**: 
  - **OCR**: Google Cloud Vision API
  - **Intelligence**: Google Gemini 2.5 Flash
- **Backend/Infrastructure**: 
  - **Database**: Firebase Firestore
  - **Auth**: Firebase Authentication
  - **Notifications**: FCM (Firebase Cloud Messaging) for outage alerts

### The Data Flow
`User Photo` $\rightarrow$ `Cloud Vision OCR` $\rightarrow$ `Gemini Extraction` $\rightarrow$ `Zone Benchmark Comparison` $\rightarrow$ `Personalized Advice (based on User Profile)` $\rightarrow$ `Firestore`

## 📋 Getting Started

### Prerequisites
- Node.js v20+
- Google Cloud Project (Vision API enabled)
- Gemini API Key (via AI Studio)
- Firebase Project (Firestore & Auth enabled)

### Installation
1. **Clone & Install**:
   ```bash
   git clone https://github.com/your-username/ai-studio-applet.git
   cd ai-studio-applet
   npm install
   ```

2. **Environment Setup**:
   Create a `.env.local` file:
   ```env
   GEMINI_API_KEY=your_api_key_here
   # Add your Firebase configuration variables here
   ```

3. **Launch**:
   ```bash
   npm run dev
   ```

## 🛡️ Security & Integrity
- **Token-Based Auth**: All API routes (`/api/analyze-bill`, `/api/report-outage`, etc.) are secured via Firebase ID Token verification.
- **Data Confidence**: Employs a confidence-scoring algorithm to flag low-quality OCR scans, ensuring users review critical billing data.

## 📝 License
MIT
