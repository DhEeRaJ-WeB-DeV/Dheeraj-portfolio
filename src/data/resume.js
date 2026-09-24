export const profile = {
  name: "Dheeraj Sure",
  role: "Software Developer",
  phone: "+91 7204552865",
  email: "dheerajsure595@gmail.com",
  github: "https://github.com/DhEeRaJ-WeB-DeV",
  linkedin: "https://www.linkedin.com/in/dheeraj-sure/",
  instagram: "https://www.instagram.com/dheeraj.s_005/",
  location: "Bengaluru, India",
  blurb:
    "A Software Engineer who enjoys turning problems into working solutions. I’m curious about how things work behind the scenes, quick to troubleshoot, and always looking for a better way to build.",
};

export const skillGroups = [
  {
    id: "languages",
    label: "Languages",
    category: "frontend",
    items: ["JavaScript", "TypeScript", "Golang"],
  },
  {
    id: "frontend",
    label: "Frontend",
    category: "frontend",
    items: ["React.js", "HTML5", "CSS3", "Tailwind CSS"],
  },
  {
    id: "backend",
    label: "Backend",
    category: "backend",
    items: ["Node.js", "Express.js", "Django", "JWT", "WebSockets"],
  },
  {
    id: "data",
    label: "Databases & Caching",
    category: "data",
    items: ["MongoDB", "PostgreSQL", "Redis"],
  },
  {
    id: "cloud",
    label: "Cloud & DevOps",
    category: "infra",
    items: ["AWS","Docker", "Git", "CI/CD","n8n"],
  },
  {
    id: "monitoring",
    label: "Monitoring",
    category: "infra",
    items: ["Prometheus", "Grafana", "Loki"],
  },
  {
    id: "testing",
    label: "Testing",
    category: "data",
    items: ["Jest", "Vitest", "Postman"],
  },
];

export const experience = [
 {
  role: "Software Engineer",
  org: "Sumeru Digital Solutions",
  period: "June 2026 — Sep 2026",
  points: [
    "Designed and implemented 15+ production REST APIs using Node.js and Express.js, with robust validation, error handling, and CRUD operations integrated with MongoDB.",
    "Built and integrated a multi-channel notification system supporting WhatsApp, email, and in-app notifications, with backend workflows for triggering and delivering notifications based on application events.",
    "Integrated OAuth-based authentication and authorization, implementing secure user access and authentication flows across the application.",
    "Designed and optimized MongoDB database queries and data-access logic to efficiently retrieve and manage application data.",
    "Diagnosed and resolved API/database integration issues by analyzing logs and reproducing failures in test environments prior to deployment.",
    "Troubleshot and validated API endpoints using Postman and Thunder Client.",
    "Collaborated through Git/GitHub using Agile development practices, code reviews, and team-based development workflows.",
  ],
},
  {
    role: "Web Developer",
      org: "Mind Matrix",
      period: "Feb 2026 — May 2026",
      points: [
        "Built an automated deployment agent that runs the test suite on every release, detects the specific files where tests fail, analyzes the underlying code, documents root-cause analysis, and applies corrective fixes automatically before redeploying.",
        "Reduced average deployment time by ~40% by eliminating manual debugging and repeated redeploy cycles for failed builds.",
        "Fixed bugs across the existing codebase by tracing issues to their root cause and applying targeted corrections, improving overall application stability.",
      ],
  },
];

export const education = [
  {
    degree: "B.E. — Robotics and Artificial Intelligence",
    org: "Bangalore Institute of Technology",
    period: "2022 — 2026",
    detail: "CGPA: 8.0 / 10.0",
  },
  {
    degree: "Pre-University Course (PCM)",
    org: "Sri Chaitanya College of Education",
    period: "2020 — 2022",
    detail: "Score: 91%",
  },
  {
    degree: "Secondary School Certificate (SSLC / 10th)",
    org: "St. Anne's Lions High School",
    period: "2019 — 2020",
    detail: "Score: 76%",
  },
];

export const projects = [
  {
    id: "chat",
    name: "Real-Time Chat Web Application",
    tagline: "Sub-100ms delivery across a fully observable socket layer",
    stack: ["React.js", "Zustand", "Node.js", "Socket.IO", "MongoDB", "Redis", "JWT", "Prometheus", "Grafana", "Loki", "Docker"],
    points: [
      "Scalable real-time messaging platform using WebSocket (Socket.IO) for sub-100ms message delivery.",
      "Containerized with Docker and deployed live; rate limiting, JWT auth, and Redis session caching end-to-end.",
      "Prometheus + Grafana dashboards and Loki log aggregation for full observability across API latency and socket connections.",
    ],
    challenges: [
      "Keeping delivery under 100ms once concurrent socket connections scaled past a few hundred users.",
      "Session state was duplicating across reconnects — fixed by centralizing JWT-backed sessions in Redis instead of per-connection memory.",
      "Observability was a blind spot early on; wired up Prometheus, Grafana, and Loki so latency spikes surface before users report them.",
    ],
    links: { github: "https://github.com/DhEeRaJ-WeB-DeV/MERN-ChatApp",
             demo: "https://mern-chatapp-gshr.onrender.com/", 
             docker: "https://hub.docker.com/r/dheeraj5559/chat-app" },
    accent: "backend",
    status: "LIVE",
  },
  {
    id: "interview",
    name: "AI-Based Interview Platform",
    tagline: "LLM-generated interviews with speech-to-text scoring",
    stack: ["React.js", "Node.js", "Express.js", "MongoDB", "JWT", "OpenAI LLM", "Docker", "Cloudinary", "Nodemailer"],
    points: [
      "Full-stack platform with dedicated admin, recruiter, and candidate portals, each backed by its own REST API.",
      "Integrated an LLM to dynamically generate interview questions, with video recording and speech-to-text transcription.",
      "JWT auth, Cloudinary media storage, and Nodemailer for email/OTP verification — containerized for portable deployment.",
    ],
    challenges: [
      "Getting the LLM to ask role-relevant questions instead of generic ones needed carefully structured prompts per job description.",
      "Speech-to-text transcripts drifted out of sync with recorded video on slower connections — fixed by buffering and re-aligning timestamps.",
      "Keeping admin, recruiter, and candidate portals on one codebase without the REST API turning into a permissions maze.",
    ],
    links: { github: "https://github.com/DhEeRaJ-WeB-DeV/AI-Based-Interview-Platform", 
      demo: "https://ai-based-interview-platform-akash-rs-projects-389e4c72.vercel.app/",
            docker: "https://hub.docker.com/repositories/dheeraj5559"
           },
    accent: "data",
    status: "SHIPPED",
  },
  {
    id: "notes",
    name: "Simple Notes Application",
    tagline: "A clean CRUD reference build — React on Django REST",
    stack: ["React.js", "Django", "Django REST Framework", "PostgreSQL", "Axios", "CSS"],
    points: [
      "Responsive React frontend consuming a Django REST API backed by PostgreSQL.",
      "Jest tests on the frontend and Django test-client coverage on the backend for endpoints and UI flows.",
    ],
    challenges: [
      "Wiring Django REST Framework serializers to match exactly what the React app expected, without over- or under-fetching data.",
      "Writing tests that caught real regressions across both Jest on the frontend and Django's test client on the backend, not just the happy path.",
    ],
    links: { github: "https://github.com/DhEeRaJ-WeB-DeV/Django_React" },
    accent: "frontend",
    status: "STABLE",
  },
  {
  id: "ecommerce",
  name: "E-Commerce Online Store",
  tagline: "Modern storefront with filtering, cart management, and responsive shopping experience",

  stack: [
    "React.js",
    "JavaScript",
    "CSS",
    "React Router",
    "Context API"
  ],

  points: [
    "Built a responsive e-commerce frontend featuring product browsing, category filtering, product detail pages, and shopping cart functionality.",
    "Implemented client-side cart management with dynamic quantity updates, subtotal calculations, and persistent shopping state.",
    "Designed reusable React components and optimized rendering for smooth user interactions across desktop and mobile devices.",
    "Integrated product search and filtering capabilities to improve product discovery and user experience."
  ],

  challenges: [
    "Managing cart state across multiple components while keeping UI updates synchronized without unnecessary re-renders.",
    "Designing reusable product and cart components that could adapt to different product categories and layouts.",
    "Handling edge cases such as duplicate cart items, quantity validation, and maintaining cart totals accurately.",
    "Creating a responsive shopping experience that remained intuitive across different screen sizes."
  ],

  links: {
    github: "https://github.com/DhEeRaJ-WeB-DeV/React-Tutorial-Projects/tree/main/OnlineStore"
  },

  accent: "frontend",
  status: "STABLE",
},
{
  id: "recipe",
  name: "Recipe Application",
  tagline: "Recipe discovery platform powered by React, TypeScript, and Zustand",

  stack: [
    "React.js",
    "TypeScript",
    "Tailwind CSS",
    "Zustand"
  ],

  points: [
    "Developed a recipe browsing application with detailed recipe views, ingredient lists, and intuitive navigation.",
    "Utilized Zustand for lightweight and scalable global state management, reducing prop drilling across components.",
    "Implemented TypeScript throughout the application to improve type safety and maintainable component development.",
    "Created responsive layouts using Tailwind CSS with smooth transitions and user-friendly interactions."
  ],

  challenges: [
    "Designing a scalable state structure in Zustand that allowed components to share recipe data efficiently.",
    "Ensuring strong TypeScript typing for recipes, ingredients, and application state while maintaining developer productivity.",
    "Building reusable UI components that could display varying recipe structures without breaking layouts.",
    "Managing loading and error states gracefully to maintain a smooth user experience."
  ],

  links: {
    github: "https://github.com/DhEeRaJ-WeB-DeV/React-Tutorial-Projects/tree/main/zustand/Recipie%20App"
  },

  accent: "frontend",
  status: "STABLE",
},
{
  id: "todo",
  name: "Todo List Application",
  tagline: "Task management system with Zustand-powered state management",

  stack: [
    "React.js",
    "TypeScript",
    "Tailwind CSS",
    "Zustand"
  ],

  points: [
    "Built a responsive task management application supporting task creation, completion tracking, editing, and deletion.",
    "Implemented centralized state management using Zustand for predictable updates and improved scalability.",
    "Leveraged TypeScript interfaces to enforce type-safe task operations and reduce runtime errors.",
    "Designed a clean and mobile-friendly user interface using Tailwind CSS with efficient component reuse."
  ],

  challenges: [
    "Maintaining immutable state updates while supporting create, update, delete, and completion workflows.",
    "Preventing unnecessary component re-renders as the task list grew in size.",
    "Designing a scalable state architecture that could support future features such as task categories and persistence.",
    "Ensuring consistent UI behavior across different browsers and screen sizes."
  ],

  links: {
    github: "https://github.com/DhEeRaJ-WeB-DeV/React-Tutorial-Projects/tree/main/zustand/Todolist"
  },

  accent: "frontend",
  status: "STABLE",
},
{
  id: "fraction-game",
  name: "Fraction Game",
  tagline: "Interactive math game designed to make fraction learning engaging",
  stack: ["React.js", "Tailwind CSS", "Framer Motion"],
  points: [
    "Built an interactive browser-based game that helps users practice and understand fractions through visual and interactive challenges.",
    "Implemented dynamic game interactions with React, including question generation, answer selection, scoring, and game-state updates.",
    "Used Framer Motion to create smooth animations and visual feedback for correct and incorrect answers.",
    "Designed a responsive interface with Tailwind CSS that works across desktop and mobile screen sizes.",
  ],
  challenges: [
    "Managing multiple game states such as questions, user selections, score tracking, and game completion without making the component logic difficult to maintain.",
    "Creating animations that provided meaningful feedback without distracting from the actual gameplay.",
    "Designing fraction-based interactions that remained intuitive and easy to understand while keeping the game visually engaging.",
    "Keeping the game responsive so interactive elements remained usable across different screen sizes.",
  ],
  links: {
    github: "https://github.com/DhEeRaJ-WeB-DeV/Fraction-game"
  },
  accent: "frontend",
  status: "STABLE",
},

];
