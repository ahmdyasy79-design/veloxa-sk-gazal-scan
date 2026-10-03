// VELOXA & SK GAZAL SCAN
// Calibrated Subscriber Reality Audit
//
// الهدف:
// - تحليل إحصائي متعدد الإشارات.
// - عدم اعتبار مؤشر واحد دليلًا كافيًا.
// - تقليل الـ False Positives.
// - إعطاء HIGH_RISK فقط عند وجود نمط قوي ومتكرر.
// - عدم اختراع عدد مشتركين حقيقي/وهمي بدون Member Sample.

export type RealityLevel =
  | "LOW_RISK"
  | "MEDIUM_RISK"
  | "HIGH_RISK"
  | "INSUFFICIENT_DATA";

export interface RealityPost {
  views: number;
  reactions: number;
  forwards: number;
  replies: number;
  publishedAt?: string;
}

export interface RealityAuditInput {
  subscribers: number;
  posts: RealityPost[];

  // Optional member sampling.
  sampledMembers?: number;
  activeSampleMembers?: number;
}

export interface RealityAuditResult {
  available: boolean;
  level: RealityLevel;

  riskScore: number;
  confidence: number;

  subscribers: number;

  averageViews: number;
  medianViews: number;

  averageViewRatio: number;
  medianViewRatio: number;

  averageEngagement: number;

  averageReactionRatio: number;
  medianReactionRatio: number;

  reactionDispersion: number;
  viewDispersion: number;

  repeatedViewCounts: number;
  repeatedReactionCounts: number;

  viewRange: number;
  reactionRange: number;

  estimatedRealSubscribers: number | null;
  estimatedFakeSubscribers: number | null;

  signals: string[];
  warnings: string[];

  postsAnalyzed: number;
  analyzedAt: string;
}

function safeNumber(value: unknown): number {
  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return Math.max(0, value);
  }

  return 0;
}

function round(value: number, digits = 4): number {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

function mean(values: number[]): number {
  if (!values.length) return 0;

  return (
    values.reduce(
      (sum, value) => sum + value,
      0
    ) / values.length
  );
}

function median(values: number[]): number {
  if (!values.length) return 0;

  const sorted = [...values].sort(
    (a, b) => a - b
  );

  const middle = Math.floor(
    sorted.length / 2
  );

  if (sorted.length % 2 === 0) {
    return (
      (sorted[middle - 1] +
        sorted[middle]) /
      2
    );
  }

  return sorted[middle];
}

function standardDeviation(
  values: number[]
): number {
  if (values.length < 2) return 0;

  const average = mean(values);

  const variance =
    values.reduce(
      (sum, value) =>
        sum +
        Math.pow(value - average, 2),
      0
    ) / values.length;

  return Math.sqrt(variance);
}

function coefficientOfVariation(
  values: number[]
): number {
  if (values.length < 2) return 0;

  const average = mean(values);

  if (average <= 0) return 0;

  return standardDeviation(values) / average;
}

function uniqueCount(
  values: number[]
): number {
  return new Set(
    values.map((value) => Math.round(value))
  ).size;
}

function repeatedCount(
  values: number[]
): number {
  if (!values.length) return 0;

  const counts = new Map<number, number>();

  for (const value of values) {
    const normalized = Math.round(value);

    counts.set(
      normalized,
      (counts.get(normalized) || 0) + 1
    );
  }

  let repeated = 0;

  for (const count of counts.values()) {
    if (count >= 2) {
      repeated += count;
    }
  }

  return repeated;
}

function valueRange(
  values: number[]
): number {
  if (!values.length) return 0;

  return (
    Math.max(...values) -
    Math.min(...values)
  );
}

function clamp(
  value: number,
  min: number,
  max: number
): number {
  return Math.max(
    min,
    Math.min(max, value)
  );
}

function ratio(
  numerator: number,
  denominator: number
): number {
  if (
    numerator <= 0 ||
    denominator <= 0
  ) {
    return 0;
  }

  return numerator / denominator;
}

function calculateEngagement(
  post: RealityPost
): number {
  const views = safeNumber(post.views);

  if (views <= 0) return 0;

  const interactions =
    safeNumber(post.reactions) +
    safeNumber(post.forwards) +
    safeNumber(post.replies);

  return interactions / views;
}

function calculateReactionRatio(
  post: RealityPost
): number {
  const views = safeNumber(post.views);

  if (views <= 0) return 0;

  return (
    safeNumber(post.reactions) /
    views
  );
}

function normalizePosts(
  posts: RealityPost[]
): RealityPost[] {
  return posts
    .map((post) => ({
      views: safeNumber(post.views),
      reactions: safeNumber(
        post.reactions
      ),
      forwards: safeNumber(
        post.forwards
      ),
      replies: safeNumber(
        post.replies
      ),
      publishedAt: post.publishedAt,
    }))
    .filter(
      (post) => post.views > 0
    );
}

export function auditChannelReality(
  input: RealityAuditInput
): RealityAuditResult {
  const checkedAt =
    new Date().toISOString();

  const subscribers = safeNumber(
    input.subscribers
  );

  const posts = normalizePosts(
    Array.isArray(input.posts)
      ? input.posts
      : []
  );

  const warnings: string[] = [];
  const signals: string[] = [];

  if (posts.length < 5) {
    return {
      available: false,
      level: "INSUFFICIENT_DATA",

      riskScore: 0,
      confidence: 20,

      subscribers,

      averageViews: 0,
      medianViews: 0,

      averageViewRatio: 0,
      medianViewRatio: 0,

      averageEngagement: 0,

      averageReactionRatio: 0,
      medianReactionRatio: 0,

      reactionDispersion: 0,
      viewDispersion: 0,

      repeatedViewCounts: 0,
      repeatedReactionCounts: 0,

      viewRange: 0,
      reactionRange: 0,

      estimatedRealSubscribers: null,
      estimatedFakeSubscribers: null,

      signals: [
        "INSUFFICIENT_POST_DATA",
      ],

      warnings: [
        "NOT_ENOUGH_POSTS_FOR_STATISTICAL_AUDIT",
      ],

      postsAnalyzed: posts.length,
      analyzedAt: checkedAt,
    };
  }

  const views = posts.map(
    (post) => post.views
  );

  const reactions = posts.map(
    (post) => post.reactions
  );

  const viewRatios = posts.map(
    (post) =>
      ratio(
        post.views,
        subscribers
      )
  );

  const engagementRates =
    posts.map(
      calculateEngagement
    );

  const reactionRatios =
    posts.map(
      calculateReactionRatio
    );

  const averageViews = mean(views);
  const medianViews = median(views);

  const averageViewRatio =
    mean(viewRatios);

  const medianViewRatio =
    median(viewRatios);

  const averageEngagement =
    mean(engagementRates);

  const averageReactionRatio =
    mean(reactionRatios);

  const medianReactionRatio =
    median(reactionRatios);

  const viewDispersion =
    coefficientOfVariation(views);

  const reactionDispersion =
    coefficientOfVariation(
      reactions
    );

  const repeatedViewCounts =
    repeatedCount(views);

  const repeatedReactionCounts =
    repeatedCount(reactions);

  const viewRange =
    valueRange(views);

  const reactionRange =
    valueRange(reactions);

  let riskScore = 0;

  // =========================================================
  // SIGNAL 1
  // Very low subscriber -> view ratio
  //
  // مهم:
  // لا يتم اعتباره HIGH RISK وحده.
  // =========================================================

  const veryLowViewRatio =
    medianViewRatio < 0.02;

  const lowViewRatio =
    medianViewRatio < 0.05;

  if (veryLowViewRatio) {
    riskScore += 1;

    signals.push(
      "VERY_LOW_MEDIAN_VIEW_RATIO"
    );
  } else if (lowViewRatio) {
    riskScore += 0.5;

    signals.push(
      "LOW_MEDIAN_VIEW_RATIO"
    );
  }

  // =========================================================
  // SIGNAL 2
  // Extremely stable views
  // =========================================================

  const extremelyStableViews =
    viewDispersion <= 0.025;

  const highlyStableViews =
    viewDispersion <= 0.06;

  if (extremelyStableViews) {
    riskScore += 3;

    signals.push(
      "EXTREMELY_STABLE_VIEW_PATTERN"
    );
  } else if (highlyStableViews) {
    riskScore += 1.5;

    signals.push(
      "HIGH_VIEW_STABILITY"
    );
  }

  // =========================================================
  // SIGNAL 3
  // Exact / repeated view counts
  // =========================================================

  const repeatedViewRatio =
    repeatedViewCounts /
    posts.length;

  const strongViewRepetition =
    repeatedViewRatio >= 0.75;

  const moderateViewRepetition =
    repeatedViewRatio >= 0.55;

  if (strongViewRepetition) {
    riskScore += 3;

    signals.push(
      "HIGH_VIEW_COUNT_REPETITION"
    );
  } else if (
    moderateViewRepetition
  ) {
    riskScore += 1;

    signals.push(
      "REPEATED_VIEW_COUNT_PATTERN"
    );
  }

  // =========================================================
  // SIGNAL 4
  // Reaction repetition
  //
  // أقل وزن من View repetition.
  // لأن ثبات عدد الـ reactions وحده لا يكفي.
  // =========================================================

  const repeatedReactionRatio =
    repeatedReactionCounts /
    posts.length;

  const strongReactionRepetition =
    repeatedReactionRatio >= 0.85;

  const moderateReactionRepetition =
    repeatedReactionRatio >= 0.65;

  if (strongReactionRepetition) {
    riskScore += 1.5;

    signals.push(
      "EXTREMELY_STABLE_REACTION_PATTERN"
    );
  } else if (
    moderateReactionRepetition
  ) {
    riskScore += 0.5;

    signals.push(
      "REPEATED_REACTION_PATTERN"
    );
  }

  // =========================================================
  // SIGNAL 5
  // Reaction/View ratio
  //
  // لا نرفع الـ risk بشدة بسبب هذا المؤشر وحده.
  // =========================================================

  const highReactionViewRatio =
    medianReactionRatio >= 0.15;

  const extremeReactionViewRatio =
    medianReactionRatio >= 0.30;

  if (
    extremeReactionViewRatio
  ) {
    riskScore += 1;

    signals.push(
      "VERY_HIGH_REACTION_VIEW_RATIO"
    );
  } else if (
    highReactionViewRatio
  ) {
    riskScore += 0.5;

    signals.push(
      "HIGH_REACTION_VIEW_RATIO"
    );
  }

  // =========================================================
  // SIGNAL 6
  // Extremely narrow view range
  // =========================================================

  const averageViewSafe =
    Math.max(1, averageViews);

  const relativeViewRange =
    viewRange / averageViewSafe;

  const extremelyNarrowViewRange =
    relativeViewRange <= 0.05;

  if (
    extremelyNarrowViewRange &&
    repeatedViewRatio >= 0.55
  ) {
    riskScore += 2;

    signals.push(
      "EXTREMELY_NARROW_VIEW_RANGE"
    );
  }

  // =========================================================
  // SIGNAL 7
  // Extremely narrow reaction range
  // =========================================================

  const averageReactionSafe =
    Math.max(
      1,
      mean(reactions)
    );

  const relativeReactionRange =
    reactionRange /
    averageReactionSafe;

  if (
    relativeReactionRange <= 0.05 &&
    repeatedReactionRatio >= 0.75
  ) {
    riskScore += 1;

    signals.push(
      "EXTREMELY_NARROW_REACTION_RANGE"
    );
  }

  // =========================================================
  // MULTI SIGNAL CONFIRMATION
  //
  // لا يكفي مجرد وجود إشارات كثيرة.
  // نبحث عن إشارات مستقلة وقوية.
  // =========================================================

  const strongSignals = [
    extremelyStableViews,
    strongViewRepetition,
    strongReactionRepetition,
    extremelyNarrowViewRange,
    extremelyNarrowViewRange &&
      strongReactionRepetition,
    veryLowViewRatio,
  ].filter(Boolean).length;

  const independentSignals =
    [
      extremelyStableViews ||
        highlyStableViews,

      strongViewRepetition,

      strongReactionRepetition,

      extremelyNarrowViewRange,

      veryLowViewRatio,

      highReactionViewRatio,
    ].filter(Boolean).length;

  // Strong confirmation only when
  // there are at least 3 independent patterns.
  if (
    strongSignals >= 3 &&
    independentSignals >= 4
  ) {
    riskScore += 4;

    signals.push(
      "STRONG_MULTI_SIGNAL_CONFIRMATION"
    );
  } else if (
    strongSignals >= 2 &&
    independentSignals >= 3
  ) {
    riskScore += 1.5;

    signals.push(
      "MULTI_SIGNAL_CONFIRMATION"
    );
  }

  // =========================================================
  // MEMBER SAMPLE
  //
  // لو Telegram سمح لنا بعينة أعضاء،
  // نستخدمها كإشارة إضافية.
  // =========================================================

  const sampledMembers =
    safeNumber(
      input.sampledMembers
    );

  const activeSampleMembers =
    safeNumber(
      input.activeSampleMembers
    );

  let estimatedRealSubscribers:
    | number
    | null = null;

  let estimatedFakeSubscribers:
    | number
    | null = null;

  if (
    sampledMembers > 0 &&
    activeSampleMembers >= 0
  ) {
    const activeRatio =
      clamp(
        activeSampleMembers /
          sampledMembers,
        0,
        1
      );

    estimatedRealSubscribers =
      Math.round(
        subscribers *
          activeRatio
      );

    estimatedFakeSubscribers =
      Math.max(
        0,
        subscribers -
          estimatedRealSubscribers
      );

    if (activeRatio < 0.25) {
      riskScore += 4;

      signals.push(
        "VERY_LOW_ACTIVE_MEMBER_RATIO"
      );
    } else if (
      activeRatio < 0.45
    ) {
      riskScore += 2;

      signals.push(
        "LOW_ACTIVE_MEMBER_RATIO"
      );
    }
  } else {
    warnings.push(
      "MEMBER_SAMPLE_UNAVAILABLE_TELEGRAM_PERMISSION"
    );

    warnings.push(
      "STATISTICAL_ESTIMATE_ONLY_NO_MEMBER_VERIFICATION"
    );
  }

  // =========================================================
  // CONFIDENCE
  // =========================================================

  let confidence = 55;

  if (posts.length >= 20) {
    confidence += 10;
  } else if (posts.length >= 10) {
    confidence += 5;
  }

  if (
    sampledMembers > 0
  ) {
    confidence += 15;
  }

  if (
    strongSignals >= 3
  ) {
    confidence += 5;
  }

  confidence = clamp(
    confidence,
    20,
    95
  );

  // Without member verification,
  // do not pretend confidence is extremely high.
  if (
    sampledMembers <= 0
  ) {
    confidence = Math.min(
      confidence,
      75
    );
  }

  // =========================================================
  // FINAL CLASSIFICATION
  //
  // HIGH:
  // requires strong multi-signal confirmation.
  //
  // MEDIUM:
  // several statistical anomalies.
  //
  // LOW:
  // no strong combined pattern.
  // =========================================================

  let level: RealityLevel;

  if (
    posts.length < 5
  ) {
    level =
      "INSUFFICIENT_DATA";
  } else if (
    strongSignals >= 3 &&
    independentSignals >= 4 &&
    riskScore >= 10
  ) {
    level = "HIGH_RISK";
  } else if (
    riskScore >= 6 &&
    independentSignals >= 3
  ) {
    level = "MEDIUM_RISK";
  } else {
    level = "LOW_RISK";
  }

  // =========================================================
  // Additional warning
  // =========================================================

  if (
    level === "HIGH_RISK" ||
    level === "MEDIUM_RISK"
  ) {
    warnings.push(
      "MULTIPLE_PATTERNS_DETECTED_REVIEW_RECOMMENDED"
    );
  }

  return {
    available: true,

    level,

    riskScore: round(
      riskScore,
      2
    ),

    confidence: Math.round(
      confidence
    ),

    subscribers,

    averageViews: Math.round(
      averageViews
    ),

    medianViews: Math.round(
      medianViews
    ),

    averageViewRatio: round(
      averageViewRatio,
      4
    ),

    medianViewRatio: round(
      medianViewRatio,
      4
    ),

    averageEngagement: round(
      averageEngagement,
      5
    ),

    averageReactionRatio: round(
      averageReactionRatio,
      5
    ),

    medianReactionRatio: round(
      medianReactionRatio,
      5
    ),

    reactionDispersion: round(
      reactionDispersion,
      4
    ),

    viewDispersion: round(
      viewDispersion,
      4
    ),

    repeatedViewCounts,

    repeatedReactionCounts,

    viewRange: Math.round(
      viewRange
    ),

    reactionRange: Math.round(
      reactionRange
    ),

    estimatedRealSubscribers,

    estimatedFakeSubscribers,

    signals: [
      ...new Set(signals),
    ],

    warnings: [
      ...new Set(warnings),
    ],

    postsAnalyzed:
      posts.length,

    analyzedAt:
      checkedAt,
  };
}

// Compatibility alias.
// channel-scan route can use either name.
export const analyzeReality =
  auditChannelReality;