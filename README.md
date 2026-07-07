# 🛒 AI-Powered E-commerce Personalization Engine

An AI-powered web application that analyzes customer shopping behavior using **Google Gemini AI** and classifies users into different behavioral segments. Based on the analysis, the system provides personalized recommendations to improve customer engagement and conversion.

---

# 📌 Project Overview

This application processes a customer's shopping activity and uses **Google Gemini** to identify shopping intent. It classifies customers into predefined behavioral states and generates personalized recommendations in real time with a confidence score and supporting evidence.

### Supported Customer States

* Browser
* Comparer
* Discount Seeker
* Cart Abandoner
* Loyal Customer

---

# 🚀 Features

* AI-powered customer behavior analysis
* Real-time shopper classification
* Personalized recommendations
* Confidence score generation
* Evidence-based reasoning
* JSON response validation
* RESTful API architecture
* Request timeout handling
* Robust error handling
* Health monitoring endpoint
* Clean and responsive user interface

---

# 🏗️ Tech Stack

## Frontend

* HTML5
* CSS3
* JavaScript

## Backend

* Node.js
* Express.js
* CORS
* Dotenv

## AI Integration

* Google Gemini API
* `@google/genai`
* Gemini 2.5 Flash

---
Structure.....................................


Sample/
│
├── client/
│   └── client/
│       ├── public/
│       ├── src/
│       │   ├── assets/
│       │   ├── App.css
│       │   ├── App.jsx
│       │   ├── index.css
│       │   └── main.jsx
│       │
│       ├── index.html
│       ├── package.json
│       ├── package-lock.json
│       ├── vite.config.js
│       ├── eslint.config.js
│       └── README.md
│
├── Server/
│   ├── app.js
│   ├── package.json
│   ├── package-lock.json
│   ├── .env
│   └── node_modules/
│
└── README.md



---

# ⚙️ Installation

## 1. Clone Repository

```bash
git clone <repository-url>
```

---

## 2. Backend Setup

```bash
cd Server
npm install
```

---

## 3. Configure Environment Variables

Create a `.env` file inside the **Server** folder.

Example:

```env
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
GEMINI_MODEL=gemini-2.5-flash
PORT=5000
CORS_ORIGIN=*
REQUEST_TIMEOUT_MS=30000
```

---

## 4. Start Backend

```bash
node app.js
```

Backend runs on:

```text
http://localhost:5000
```

---

## 5. Open Frontend

Open the **Client/index.html** file in your browser (or serve it using Live Server).

---

# 📡 API Endpoints

## Health Check

```http
GET /health
```

### Example Response

```json
{
  "status": "ok",
  "model": "gemini-2.5-flash",
  "uptimeSeconds": 125,
  "timestamp": "2026-07-07T15:37:19.920Z"
}
```

---

## Analyze Shopper Behavior

```http
POST /analyze
```

### Request

```json
{
  "events": [
    "Visited homepage",
    "Searched for running shoes",
    "Compared multiple products",
    "Added an item to the cart"
  ]
}
```

### Example Response

```json
{
  "state": "Cart Abandoner",
  "confidence": "92%",
  "evidence": [
    "Compared multiple products",
    "Added item to cart",
    "Did not complete checkout"
  ],
  "recommendation": "Send a personalized discount reminder to encourage purchase completion.",
  "reason": "The customer showed strong purchase intent but abandoned the checkout process before placing the order."
}
```

---

# 🔄 Application Workflow

```text
Customer Shopping Events
           │
           ▼
 HTML/CSS/JavaScript Frontend
           │
           ▼
 Express.js REST API
           │
           ▼
 Google Gemini API
           │
           ▼
 AI Analysis
           │
           ▼
 JSON Response
           │
           ▼
 Personalized Recommendation Dashboard
```

---

# 🛡️ Error Handling

The application includes:

* Input validation
* Invalid request handling
* Request timeout handling
* Gemini API error handling
* JSON response validation
* Graceful server-side error responses
* Health monitoring endpoint

---

# 💡 Future Improvements

* User Authentication
* MongoDB Integration
* Customer Purchase History
* Admin Dashboard
* Analytics Dashboard
* Real-time Recommendations
* Email & Push Notifications
* User Feedback System
* Deployment on AWS/Vercel/Render

---

# 🎯 Learning Outcomes

This project demonstrates practical experience with:

* REST API Development
* Google Gemini API Integration
* Prompt Engineering
* Express.js Backend Development
* Frontend Development using HTML, CSS & JavaScript
* Environment Variable Management
* Error Handling
* JSON Processing
* Client-Server Communication

---

# 👨‍💻 Author

**Anit Sagar**

B.Tech – Computer Science & Engineering

ABES Engineering College

---


