export type ResumeSignal = {
  label: string;
  value: string;
  detail: string;
};

export type ResumeExperience = {
  slug: string;
  role: string;
  company: string;
  location: string;
  period: string;
  summary: string;
  bullets: string[];
};

export type ResumeProject = {
  slug: string;
  name: string;
  period: string;
  summary: string;
  details: string[];
  link?: {
    label: string;
    href: string;
  };
};

export type ResumeSkillGroup = {
  title: string;
  items: string[];
  note?: string;
};

export type ResumeContactItem = {
  label: string;
  value: string;
  href?: string;
};

export type EducationRecord = {
  school: string;
  degree: string;
  location: string;
  period: string;
  highlights: string[];
};

export const resumeData = {
  name: 'Chris Pecunies',
  role: 'Software Engineer',
  statement:
    'Software engineer specializing in cloud services, workflow automation, distributed systems, and full-stack cloud applications.',
  commandBanner: './resume --overview',
  availability:
    'Open to platform engineering, DevOps, cloud architecture, full-stack systems, and runtime-heavy product work.',
  location: 'Seattle, WA',
  summary: [
    'Software Engineer with 4+ years of experience specializing in cloud services across AWS, Azure, GCP, and OCI, workflow automation and orchestration tooling, CI/CD pipelines, and Infrastructure as Code utilities such as Ansible, Terraform, and Kubernetes.',
    'Proficient in Python, C++, Rust, Go, SQL, and TypeScript, with experience developing full-stack applications and integrating complex interconnected cloud services and infrastructure.',
    'Implemented distributed systems and databases, created technical training material for AWS, Azure, GCP, and OCI, and used multilayered cloud architecture to develop and deploy mission-critical APIs and applications for customers and internal tooling.',
  ],
  signals: [
    {
      label: 'Cloud footprint',
      value: '4 clouds',
      detail: 'AWS, Azure, GCP, and OCI across delivery, training, and production systems.',
    },
    {
      label: 'Chain operations',
      value: '8+ envs',
      detail: 'Managed and hardened multi-tier blockchain infrastructure with GitOps controls.',
    },
    {
      label: 'Reliability',
      value: '99.9%',
      detail: 'Built CI/CD-backed cloud architecture with Prometheus and Grafana visibility.',
    },
    {
      label: 'Systems projects',
      value: 'WASM + AWS',
      detail: 'Zig WebAssembly runtime work plus an AWS marketplace aggregator prototype.',
    },
  ] as ResumeSignal[],
  experience: [
    {
      slug: 'hashgraph',
      role: 'DevOps Engineer',
      company: 'HashGraph',
      location: 'Remote / Seattle, WA',
      period: 'September 2025 - November 2025',
      summary:
        'Short-cycle blockchain infrastructure role focused on GitOps, observability, security hardening, and GCP provisioning.',
      bullets: [
        'Managed multi-tier blockchain infrastructure across 8+ environments, using Grafana and ArgoCD to improve deployment management and auditability.',
        'Investigated and hardened deployment paths with cryptographic integrity checks for manifests and artifact verification.',
        'Reduced false-positive alerting for on-call engineers by tuning custom Grafana dashboards and PromQL queries.',
        'Provisioned GCP infrastructure with Terraform modules and Ansible playbooks, including Ansible Vault-backed node lifecycle management.',
      ],
    },
    {
      slug: 'wiseblocks',
      role: 'Software Engineer',
      company: 'WiseBlocks LLC',
      location: 'Hybrid / Golden, CO',
      period: 'June 2022 - April 2024',
      summary:
        'Distributed transaction database and WebAssembly VM work, plus front-end, API, and deployment architecture.',
      bullets: [
        'Developed a distributed transaction database in Go and integrated a Rust-based WebAssembly VM for secure, low-latency execution of financial smart contracts.',
        'Engineered cloud network architecture with Ansible, Terraform, Prometheus, and Grafana, supporting CI/CD flows targeting 99.9% uptime.',
        'Built a Next.js front end for real-time endpoint node and block visualization and created a Python FastAPI service to deliver data to network nodes, managing work with Jira and Confluence.',
        'Implemented serialized data structures and gRPC APIs with Protocol Buffers to minimize network overhead and secure node-to-node exchange.',
        'Contributed to system-level network architecture with emphasis on fault tolerance, consensus-aware design, and transaction finality.',
      ],
    },
    {
      slug: 'impresys',
      role: 'AWS Consultant',
      company: 'Impresys Software Corporation',
      location: 'On-site / Seattle, WA',
      period: 'September 2019 - May 2022',
      summary:
        'Cloud training, AWS CDK rollout support, process automation, and infrastructure-heavy technical delivery.',
      bullets: [
        'Developed and delivered technical training material for Azure and AWS, covering advanced cloud architecture and use cases for new and existing services.',
        'Collaborated with AWS engineers to implement AWS CDK, demonstrating and automating complex cloud architecture setup using Infrastructure-as-Code tooling.',
        'Created CI/CD and DevOps process material alongside AWS and Azure engineers while provisioning infrastructure and data engineering workloads.',
        'Led modernization work refactoring legacy workflows and internal applications to modern Python with Qt/QML GUI and OpenCV image processing, increasing production velocity over sevenfold.',
      ],
    },
    {
      slug: 'gemsec',
      role: 'Research Assistant',
      company: 'University of Washington',
      location: 'On-site / Seattle, WA',
      period: 'June 2018 - April 2021',
      summary:
        'Research-side software engineering spanning containerized apps, REST APIs, data science, and scientific computing.',
      bullets: [
        'Provisioned full-stack containerized workloads and REST-backed web applications with AWS, React, Django, FastAPI, PostgreSQL, and Docker.',
        'Developed scientific simulations and analysis using Python, data modeling, and computer vision libraries.',
        'Mentored and led an undergraduate team through data analysis and machine learning techniques to identify amino acid sequence motifs linked to graphene-binding in neuropeptides.',
      ],
    },
  ] as ResumeExperience[],
  projects: [
    {
      slug: 'moe-marketplace',
      name: 'Marketplace Aggregator on AWS',
      period: 'April 2026 - Present',
      summary:
        'A serverless, message-oriented marketplace aggregation platform on AWS at moe.pecunies.com.',
      details: [
        'Designed and deployed an AWS platform using Lambda, Step Functions, DynamoDB, SQS, API Gateway, CloudFront, and AWS CDK to manage eventual consistency, rate limiting, and external marketplace failures.',
        'Engineered resilient workflows using Step Functions for transparent retry and state management.',
        'Implemented a two-layer idempotency strategy to prevent duplicate listings and HMAC-SHA256 verification for secure webhook ingestion, preventing timing attacks.',
      ],
      link: {
        label: 'moe.pecunies.com',
        href: 'https://moe.pecunies.com',
      },
    },
    {
      slug: 'zig-runtime',
      name: 'WebAssembly Runtime in Zig',
      period: 'May 2025 - Present',
      summary:
        'A performance-targeted WebAssembly runtime written in Zig with attention to memory layout, instruction dispatch, and modern spec coverage.',
      details: [
        'Achieved state-of-the-art performance in low-level benchmarks by optimizing memory layout and instruction dispatch logic in Zig.',
        'Fulfills nearly full WebAssembly 3.0 and WASI 1 preview specifications.',
      ],
      link: {
        label: 'github.com/clpi/wart.git',
        href: 'https://github.com/clpi/wart.git',
      },
    },
  ] as ResumeProject[],
  skills: [
    {
      title: 'Languages',
      items: [
        'Python - 5 years',
        'Rust - 4 years',
        'Go - 4 years',
        'JavaScript / TypeScript - 5 years',
        'C / C++ - 3 years',
        'SQL - 3 years',
        'Java / Groovy - 2 years',
        'Bash / Fish / Zsh - 5 years',
        'Zig - 3 years',
        'Nix - 2 years',
        'C# / .NET - 2 years',
        'Dart / Flutter - 2 years',
        'Swift - 2 years',
        'Kotlin - 2 years',
        'Lua - 5 years',
        'PowerShell - 1 year',
        'Ruby - 2 years',
      ],
      note: 'Programming languages listed with the experience bands from the latest resume.',
    },
    {
      title: 'Web Technologies',
      items: [
        'Django - 4 years',
        'FastAPI - 5 years',
        'Flask - 4 years',
        'React / Next.js - 5 years',
        'GraphQL - 3 years',
        'Node.js - 5 years',
        'Bun - 3 years',
        'Spring Boot - 2 years',
        'Svelte / SvelteKit - 3 years',
        'Vue.js / Nuxt.js - 2 years',
        'gRPC - 3 years',
        'Angular - 2 years',
        'Protocol Buffers - 2 years',
        'RESTful APIs - 5 years',
        'Ruby on Rails - 1 year',
      ],
      note: 'API, full-stack, and service integration technologies.',
    },
    {
      title: 'Cloud Providers & Services',
      items: [
        'AWS - 5 years',
        'AWS CDK - 3 years',
        'Microsoft Azure - 3 years',
        'GCP - 3 years',
        'Ansible - 3 years',
        'OCI - 3 years',
        'Docker / Podman - 4 years',
        'Google Firebase - 2 years',
        'Grafana - 2 years',
        'Jenkins - 2 years',
        'Prometheus - 2 years',
        'Terraform - 2 years',
        'Kubernetes - 2 years',
        'Azure DevOps - 1 year',
        'GitHub Actions / Workflows - 4 years',
      ],
      note: 'Cloud platforms, delivery systems, observability, and Infrastructure as Code.',
    },
    {
      title: 'Databases',
      items: [
        'PostgreSQL - 4 years',
        'MySQL - 3 years',
        'Apache Cassandra - 2 years',
        'Apache Kafka - 1 year',
        'MongoDB - 3 years',
        'Redis - 4 years',
        'Memcached - 2 years',
        'NoSQL - 3 years',
        'MariaDB - 3 years',
      ],
      note: 'Relational, non-relational, cache, and event-streaming systems.',
    },
    {
      title: 'AI Tools',
      items: [
        'GitHub Copilot - 4 years',
        'OpenAI Codex - 2 years',
        'Claude Code - 2 years',
        'OpenClaw / Hermes - 1 year',
        'LangChain / LangGraph - 3 years',
        'Cursor - 3 years',
        'Windsurf / Devin - 2 years',
        'Cloudflare Workers AI - 2 years',
        'Anthropic API / OpenAI API - 3 years',
      ],
      note: 'AI-assisted coding, agents, APIs, and Workers AI integration.',
    },
    {
      title: 'Other',
      items: [
        'Linux (Fedora, Arch, NixOS) - 5+ years',
        'Git / GitHub / GitLab - 5+ years',
        'Machine Learning - 3 years',
        'NGINX - 4 years',
        'Apache - 4 years',
        'Microsoft Office 365 - 5+ years',
        'Qt / QML - 2 years',
        'CI/CD pipelines - 4 years',
        'Infrastructure as Code - 3 years',
        'GitOps - 2 years',
        'Atlassian Jira - 2 years',
      ],
      note: 'Operating systems, delivery practices, tooling, and collaboration systems.',
    },
  ] as ResumeSkillGroup[],
  contact: [
    { label: 'Email', value: 'chris@pecunies.com', href: 'mailto:chris@pecunies.com' },
    { label: 'Phone', value: '(206) 321-6687', href: 'tel:2063216687' },
    { label: 'LinkedIn', value: 'linkedin.com/in/chrispecunies', href: 'https://linkedin.com/in/chrispecunies' },
    { label: 'GitHub', value: 'github.com/clpi', href: 'https://github.com/clpi' },
    { label: 'Website', value: 'pecunies.com', href: 'https://pecunies.com' },
    { label: 'Address', value: '818 West Crockett St' },
    { label: 'Location', value: 'Seattle, WA 98119' },
    { label: 'Citizenship', value: 'U.S. Citizen' },
  ] as ResumeContactItem[],
  education: {
    school: 'University of Washington',
    degree: 'B.S. Materials Science & Engineering',
    location: 'Seattle, WA',
    period: 'August 2015 - June 2019',
    highlights: [
      'Relevant coursework: database systems, data structures and algorithms, artificial intelligence, and machine learning.',
      'Graduated with degree focus in Nanotechnology & Molecular Engineering.',
      'Dean’s List academic honors recognized twice.',
    ],
  } as EducationRecord,
  pdf: {
    href: '/chris-pecunies-resume.pdf',
    previews: [
      { label: 'Page 1', image: '/resume-page-1.png', href: '/chris-pecunies-resume.pdf#page=1' },
      { label: 'Page 2', image: '/resume-page-2.png', href: '/chris-pecunies-resume.pdf#page=2' },
    ],
  },
} as const;

export type ResumeData = typeof resumeData;
