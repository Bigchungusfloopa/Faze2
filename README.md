# Modulus

**Modulus** is a premium, collaborative learning platform designed specifically for students. It combines task management, file storage, real-time communication, and community building into a single, cohesive interface.

##  Live Demo
[View Live Deployment](https://modulus-lime.vercel.app)

##  Core Features

- **📂 Vault**: A robust file management system for organizing study materials, powered by Cloudflare R2.
- **💬 Communities**: Discover, join, and create study groups with fellow students.
- **✅ Tasks**: Integrated task management with personal and collaborative workflows.
- **🎙️ Circles**: Real-time voice and video study rooms powered by LiveKit for seamless collaboration.
- **🧵 Threads**: Structured discussions and knowledge sharing within communities.
- **⚡ Focus Mode**: Dedicated tools to help you stay productive and minimize distractions.

##  Technology Stack

- **Framework**: [Next.js 16](https://nextjs.org) (App Router)
- **Backend/Auth**: [Supabase](https://supabase.com)
- **Storage**: Cloudflare R2 (S3-compatible)
- **Real-time**: [LiveKit](https://livekit.io)
- **State Management**: [TanStack Query](https://tanstack.com/query) & [Zustand](https://zustand-demo.pmnd.rs)
- **Animations**: [Framer Motion](https://www.framer.com/motion) & [GSAP](https://gsap.com)
- **Styling**: Tailwind CSS & Lucide Icons

##  Getting Started

### Prerequisites

- Node.js 18.x or higher
- A Supabase account
- A Cloudflare R2 bucket (optional for local dev)
- A LiveKit Cloud project (optional for local dev)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Bhavesh-Codes/MODULUS.git
   cd modulus
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up your environment variables:
   Create a `.env` file in the root directory and add your Supabase, LiveKit, and R2 credentials.

4. Run the development server:
   ```bash
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## License

This project is private and owned by [Bhavesh-Codes](https://github.com/Bhavesh-Codes).
