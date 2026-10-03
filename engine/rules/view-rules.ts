// VELOXA & SK GAZAL SCAN
// View Analysis Rules

export const SCAN_RULES = {
  // عدد المنشورات التي يتم تحليلها لكل قناة
  POSTS_TO_ANALYZE: 20,

  // الحد الأدنى للمعلومات المطلوبة لتحليل القناة
  MIN_POSTS_REQUIRED: 5,

  // درجات التصنيف
  QUALITY: {
    GOOD: 80,
    SEMI_GOOD: 55,
  },

  // درجات الاشتباه
  SUSPICION: {
    LOW: 0,
    MEDIUM: 3,
    HIGH: 6,
  },

  // نسبة المشاهدات إلى المشتركين
  VIEWER_RATIO: {
    HIGH: 3,
    VERY_HIGH: 5,
  },

  // سرعة المشاهدات في الدقيقة
  VIEW_SPEED: {
    HIGH: 1000,
    VERY_HIGH: 3000,
  },

  // التفاعل
  ENGAGEMENT: {
    VERY_LOW: 0.001,
    LOW: 0.003,
  },

  // القفزات الكبيرة في المشاهدات
  VIEW_JUMP: {
    HIGH: 5,
    VERY_HIGH: 10,
  },
} as const;


// ==============================
// Types
// ==============================

export type ChannelQuality =
  | "GOOD"
  | "SEMI_GOOD"
  | "WEAK";

export type SuspicionLevel =
  | "LOW"
  | "MEDIUM"
  | "HIGH";

export interface PostData {
  id: string;
  publishedAt: string;
  ageSeconds: number;
  views: number;
  viewsPerMinute: number;
  reactions: number;
  forwards: number;
  replies: number;
}

export interface PostResult {
  postId: string;

  publishedAt: string;

  // عمر المنشور بالثواني
  ageSeconds: number;

  views: number;

  // المشاهدات في الدقيقة
  viewsPerMinute: number;

  reactions: number;

  forwards: number;

  replies: number;

  suspicious: boolean;

  suspicionLevel: SuspicionLevel;

  triggeredRules: string[];

  score: number;
}

export interface ChannelResult {
  username: string;

  title: string;

  subscribers: number;

  postsAnalyzed: number;

  quality: ChannelQuality;

  qualityScore: number;

  suspicious: boolean;

  suspicionLevel: SuspicionLevel;

  suspicionScore: number;

  triggeredRules: string[];

  posts: PostResult[];

  analyzedAt: string;
}


// ==============================
// Time
// ==============================

export function getAgeSeconds(
  publishedAt: string,
  checkedAt: Date = new Date()
): number {
  const published = new Date(
    publishedAt
  ).getTime();

  const checked = checkedAt.getTime();

  if (
    !Number.isFinite(published) ||
    !Number.isFinite(checked)
  ) {
    return 0;
  }

  return Math.max(
    0,
    Math.floor(
      (checked - published) / 1000
    )
  );
}


// ==============================
// View Speed
// ==============================

export function getViewsPerMinute(
  views: number,
  ageSeconds: number
): number {
  if (
    views <= 0 ||
    ageSeconds <= 0
  ) {
    return 0;
  }

  return (
    views /
    (ageSeconds / 60)
  );
}


// ==============================
// Subscriber Ratio
// ==============================

export function getViewerRatio(
  views: number,
  subscribers: number
): number {
  if (
    views <= 0 ||
    subscribers <= 0
  ) {
    return 0;
  }

  return views / subscribers;
}


// ==============================
// Engagement
// ==============================

export function getEngagementRate(
  views: number,
  reactions: number,
  forwards: number,
  replies: number
): number {
  if (views <= 0) {
    return 0;
  }

  const interactions =
    Math.max(0, reactions) +
    Math.max(0, forwards) +
    Math.max(0, replies);

  return interactions / views;
}


// ==============================
// Suspicion Level
// ==============================

export function getSuspicionLevel(
  score: number
): SuspicionLevel {
  if (
    score >=
    SCAN_RULES.SUSPICION.HIGH
  ) {
    return "HIGH";
  }

  if (
    score >=
    SCAN_RULES.SUSPICION.MEDIUM
  ) {
    return "MEDIUM";
  }

  return "LOW";
}


// ==============================
// Quality
// ==============================

export function getQuality(
  score: number
): {
  quality: ChannelQuality;
  qualityScore: number;
} {
  const qualityScore = Math.max(
    0,
    Math.min(100, 100 - score * 10)
  );

  if (
    qualityScore >=
    SCAN_RULES.QUALITY.GOOD
  ) {
    return {
      quality: "GOOD",
      qualityScore,
    };
  }

  if (
    qualityScore >=
    SCAN_RULES.QUALITY.SEMI_GOOD
  ) {
    return {
      quality: "SEMI_GOOD",
      qualityScore,
    };
  }

  return {
    quality: "WEAK",
    qualityScore,
  };
}


// ==============================
// Single Post Analysis
// ==============================

export function analyzePost(
  post: PostData,
  subscribers: number,
  previousPost?: PostData,
  checkedAt: Date = new Date()
): PostResult {

  let score = 0;

  const triggeredRules: string[] = [];

  const ageSeconds =
    getAgeSeconds(
      post.publishedAt,
      checkedAt
    );

  const viewsPerMinute =
    getViewsPerMinute(
      post.views,
      ageSeconds
    );

  // --------------------------
  // Viewer / Subscriber Ratio
  // --------------------------

  const viewerRatio =
    getViewerRatio(
      post.views,
      subscribers
    );

  if (
    viewerRatio >=
    SCAN_RULES.VIEWER_RATIO.VERY_HIGH
  ) {
    score += 2;

    triggeredRules.push(
      "VERY_HIGH_VIEWER_RATIO"
    );
  } else if (
    viewerRatio >=
    SCAN_RULES.VIEWER_RATIO.HIGH
  ) {
    score += 1;

    triggeredRules.push(
      "HIGH_VIEWER_RATIO"
    );
  }


  // --------------------------
  // View Speed
  // --------------------------

  if (
    viewsPerMinute >=
    SCAN_RULES.VIEW_SPEED.VERY_HIGH
  ) {
    score += 2;

    triggeredRules.push(
      "VERY_HIGH_VIEW_SPEED"
    );
  } else if (
    viewsPerMinute >=
    SCAN_RULES.VIEW_SPEED.HIGH
  ) {
    score += 1;

    triggeredRules.push(
      "HIGH_VIEW_SPEED"
    );
  }


  // --------------------------
  // Engagement
  // --------------------------

  const engagement =
    getEngagementRate(
      post.views,
      post.reactions,
      post.forwards,
      post.replies
    );

  if (
    post.views >= 1000 &&
    engagement <
      SCAN_RULES.ENGAGEMENT.VERY_LOW
  ) {
    score += 1;

    triggeredRules.push(
      "VERY_LOW_ENGAGEMENT"
    );
  }


  // --------------------------
  // View Jump
  // --------------------------

  if (previousPost) {

    if (
      previousPost.views > 0
    ) {

      const jump =
        post.views /
        previousPost.views;

      if (
        jump >=
        SCAN_RULES.VIEW_JUMP.VERY_HIGH
      ) {

        score += 2;

        triggeredRules.push(
          "VERY_HIGH_VIEW_JUMP"
        );

      } else if (
        jump >=
        SCAN_RULES.VIEW_JUMP.HIGH
      ) {

        score += 1;

        triggeredRules.push(
          "HIGH_VIEW_JUMP"
        );
      }
    }
  }


  // --------------------------
  // Result
  // --------------------------

  const suspicionLevel =
    getSuspicionLevel(score);

  return {
    postId: post.id,

    publishedAt:
      post.publishedAt,

    ageSeconds,

    views: post.views,

    viewsPerMinute,

    reactions:
      post.reactions,

    forwards:
      post.forwards,

    replies:
      post.replies,

    suspicious:
      suspicionLevel !== "LOW",

    suspicionLevel,

    triggeredRules,

    score,
  };
}
