/*
 * interest-packs.js — curated, one-click interest packs used by the onboarding
 * wizard and the options page. Picking a pack seeds a strong keyword list (and a
 * few well-known channels) so the feed is immediately relevant — no manual
 * keyword hunting.
 *
 * Each pack: { id, name, emoji, description, interests: [...], allowChannels?: [...] }
 * Keywords lean on the matcher's "smart" mode (plurals/verb forms auto-match),
 * and include common synonyms/abbreviations so coverage is broad but precise.
 *
 * Dual-loadable: window.__YTIF.packs in the browser, module.exports in Node.
 */
'use strict';

const INTEREST_PACKS = [
  {
    id: 'ai-ml',
    name: 'AI & Machine Learning',
    emoji: '🤖',
    description: 'LLMs, agents, deep learning, AI research and tooling.',
    interests: [
      'ai', 'artificial intelligence', 'machine learning', 'deep learning',
      'neural network', 'llm', 'large language model', 'gpt', 'chatgpt',
      'claude', 'gemini', 'llama', 'mistral', 'transformer', 'diffusion model',
      'stable diffusion', 'generative ai', 'genai', 'agentic', 'ai agent',
      'rag', 'fine-tuning', 'embeddings', 'prompt engineering', 'openai',
      'anthropic', 'deepmind', 'hugging face', 'pytorch', 'tensorflow',
      'reinforcement learning', 'computer vision', 'nlp', 'mlops', 'multimodal',
      'foundation model', 'frontier model', 'inference', 'copilot',
    ],
    allowChannels: ['Two Minute Papers', 'Yannic Kilcher', '3Blue1Brown', 'Lex Fridman'],
  },
  {
    id: 'programming',
    name: 'Programming & Software',
    emoji: '💻',
    description: 'Coding, web/app dev, languages, frameworks, and tooling.',
    interests: [
      'programming', 'coding', 'software engineering', 'developer', 'web development',
      'javascript', 'typescript', 'python', 'rust', 'golang', 'java', 'c++',
      'react', 'vue', 'svelte', 'next.js', 'node.js', 'frontend', 'backend',
      'full stack', 'api', 'database', 'sql', 'devops', 'docker', 'kubernetes',
      'git', 'linux', 'algorithm', 'data structure', 'system design',
      'open source', 'compiler', 'cybersecurity',
    ],
    allowChannels: ['Fireship', 'ThePrimeagen', 'Theo - t3.gg'],
  },
  {
    id: 'science',
    name: 'Science & Education',
    emoji: '🔬',
    description: 'Physics, space, biology, math and explainers.',
    interests: [
      'science', 'physics', 'quantum', 'space', 'astronomy', 'cosmology',
      'nasa', 'rocket', 'spacex', 'biology', 'chemistry', 'mathematics',
      'engineering', 'experiment', 'documentary', 'explained', 'research',
      'evolution', 'neuroscience', 'genetics', 'climate', 'energy',
    ],
    allowChannels: ['Veritasium', 'Kurzgesagt – In a Nutshell', 'PBS Space Time', 'SmarterEveryDay'],
  },
  {
    id: 'finance',
    name: 'Finance & Investing',
    emoji: '📈',
    description: 'Markets, investing, economics, and personal finance.',
    interests: [
      'investing', 'investment', 'stock market', 'stocks', 'finance',
      'personal finance', 'economics', 'economy', 'crypto', 'bitcoin',
      'ethereum', 'real estate', 'index fund', 'etf', 'dividend',
      'portfolio', 'retirement', 'budgeting', 'inflation', 'interest rate',
      'federal reserve', 'recession', 'wealth', 'startup funding', 'venture capital',
    ],
  },
  {
    id: 'fitness',
    name: 'Fitness & Health',
    emoji: '💪',
    description: 'Workouts, nutrition, strength, running, and wellness.',
    interests: [
      'fitness', 'workout', 'gym', 'exercise', 'strength training', 'weightlifting',
      'bodybuilding', 'calisthenics', 'cardio', 'running', 'marathon', 'cycling',
      'nutrition', 'diet', 'protein', 'weight loss', 'muscle', 'yoga',
      'mobility', 'recovery', 'health', 'wellness', 'mental health',
    ],
  },
  {
    id: 'gaming',
    name: 'Gaming',
    emoji: '🎮',
    description: 'Game reviews, playthroughs, esports and game dev.',
    interests: [
      'gaming', 'gameplay', 'walkthrough', 'playthrough', 'game review',
      'esports', 'speedrun', 'indie game', 'game development', 'unity',
      'unreal engine', 'minecraft', 'fortnite', 'valorant', 'league of legends',
      'nintendo', 'playstation', 'xbox', 'steam', 'rpg', 'fps', 'roguelike',
    ],
  },
  {
    id: 'music',
    name: 'Music',
    emoji: '🎵',
    description: 'Production, theory, instruments, and performances.',
    interests: [
      'music', 'music production', 'songwriting', 'music theory', 'guitar',
      'piano', 'drums', 'bass', 'synth', 'ableton', 'fl studio', 'mixing',
      'mastering', 'cover song', 'live performance', 'concert', 'beat making',
      'vocals', 'composition',
    ],
  },
  {
    id: 'cooking',
    name: 'Cooking & Food',
    emoji: '🍳',
    description: 'Recipes, techniques, baking and food science.',
    interests: [
      'cooking', 'recipe', 'baking', 'food', 'chef', 'kitchen', 'meal prep',
      'pasta', 'bread', 'dessert', 'grilling', 'bbq', 'vegan', 'vegetarian',
      'food science', 'knife skills', 'sourdough', 'street food', 'restaurant',
    ],
  },
  {
    id: 'news',
    name: 'News & World',
    emoji: '🌍',
    description: 'World events, politics, analysis and geopolitics.',
    interests: [
      'news', 'breaking news', 'politics', 'world news', 'geopolitics',
      'analysis', 'economy', 'election', 'policy', 'international',
      'interview', 'debate', 'current events', 'report',
    ],
  },
  {
    id: 'cars',
    name: 'Cars & Engineering',
    emoji: '🚗',
    description: 'Reviews, EVs, motorsport, builds and mechanics.',
    interests: [
      'car', 'cars', 'automotive', 'car review', 'ev', 'electric vehicle',
      'tesla', 'motorsport', 'formula 1', 'f1', 'racing', 'engine', 'turbo',
      'restoration', 'car build', 'mechanic', 'supercar', 'off-road', 'drift',
    ],
  },
  {
    id: 'business',
    name: 'Business & Startups',
    emoji: '🚀',
    description: 'Entrepreneurship, startups, marketing and productivity.',
    interests: [
      'startup', 'entrepreneur', 'business', 'marketing', 'saas', 'product',
      'founder', 'venture capital', 'growth', 'sales', 'branding',
      'productivity', 'leadership', 'strategy', 'side hustle', 'ecommerce',
      'case study', 'business model',
    ],
  },
  {
    id: 'history',
    name: 'History',
    emoji: '📜',
    description: 'Ancient to modern history, documentaries and deep dives.',
    interests: [
      'history', 'ancient history', 'world war', 'medieval', 'empire',
      'civilization', 'archaeology', 'documentary', 'historical', 'biography',
      'cold war', 'revolution', 'mythology', 'roman', 'egypt',
    ],
  },
];

const packsModule = { INTEREST_PACKS };

if (typeof window !== 'undefined') {
  window.__YTIF = window.__YTIF || {};
  window.__YTIF.packs = packsModule;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = packsModule;
}
