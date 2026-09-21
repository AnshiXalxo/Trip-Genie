# Trip Genie

A comprehensive, full-stack travel management application designed to simplify group trip planning, coordination, and memory sharing. Trip Genie acts as your ultimate travel companion, combining AI-driven scheduling with real-time collaboration tools.

##🌟 Key Features

🤖 AI Itinerary Planner: Automatically generate optimized, day-by-day travel schedules based on user preferences, locations, and time constraints.

💸 Real-Time Expense Tracker: Log shared costs, split bills among group members, and track the overall trip budget seamlessly.

💬 Group Chat: Built-in messaging system for instant coordination and decision-making without leaving the app.

📸 Media Repository: A centralized, secure storage space for all group members to upload, view, and share trip photos and videos.

##🛠️ Tech Stack & Architecture

Frontend: React (Vite build tool)

Backend & Database: Supabase (PostgreSQL)

Architecture: Modular, Object-Oriented Programming (OOP) principles utilized for scalable backend services and efficient API integration.

##🚀 Getting Started

Prerequisites
Make sure you have Node.js and npm installed on your local machine.

Installation
Clone the repository:

Bash
git clone https://github.com/yourusername/trip-genie.git
cd trip-genie
Install dependencies:
(Note: node_modules are properly excluded via .gitignore to keep the repository lightweight.)

Bash
npm install
Set up Environment Variables:
Create a .env file in the root directory and add your Supabase and AI provider API keys. (Never commit this file to version control).

##Code snippet

VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
# Add other required API keys here
Start the development server:

##Bash
npm run dev
📁 Project Structure
/src: Contains the core React frontend components, styling, and application logic.

/server: Houses the backend API integrations, data preprocessing pipelines, and database connection logic.

/public: Static assets served directly to the browser (images, favicons, etc.).

##💡 Engineering Highlights

Optimized Data Flow: Engineered complex relational database schemas in Supabase to handle real-time synchronization between the chat, expense tracking, and media modules.

Scalable Architecture: Designed utilizing OOP concepts to cleanly separate user entities, trip instances, and financial transactions, ensuring the application remains maintainable as new features are added.

Developed by Anshi Xalxo.
