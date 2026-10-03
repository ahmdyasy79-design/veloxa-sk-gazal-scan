// VELOXA & SK GAZAL SCAN
// Advanced Channel Analyzer

import {
  SCAN_RULES,
  PostData,
  PostResult,
  ChannelQuality,
  SuspicionLevel,
  analyzePost,
  getQuality,
  getSuspicionLevel,
} from "../rules/view-rules";

export interface ChannelInput {
  username: string;
  title: string;
  subscribers: number;
  posts: PostData[];
}

export interface ChannelAnalysisResult {
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

export function analyzeChannel(
  input: ChannelInput,
  checkedAt: Date = new Date()
): ChannelAnalysisResult {
  /*
   * ==========================================
   * SORT + LIMIT POSTS
   * ==========================================
   */

  const sortedPosts = [...input.posts]
    .sort(
      (a, b) =>
        new Date(a.publishedAt).getTime() -
        new Date(b.publishedAt).getTime()
    )
    .slice(
      -SCAN_RULES.POSTS_TO_ANALYZE
    );

  const analyzedPosts: PostResult[] = [];

  /*
   * ==========================================
   * CHANNEL LEVEL STATISTICS
   * ==========================================
   */

  let totalPostScore = 0;

  const ruleOccurrences =
    new Map<string, number>();

  const channelRules =
    new Set<string>();

  /*
   * ==========================================
   * ANALYZE EVERY POST
   * ==========================================
   */

  for (
    let index = 0;
    index < sortedPosts.length;
    index++
  ) {
    const post =
      sortedPosts[index];

    const previousPost =
      index > 0
        ? sortedPosts[index - 1]
        : undefined;

    const result =
      analyzePost(
        post,
        input.subscribers,
        previousPost,
        checkedAt
      );

    analyzedPosts.push(result);

    totalPostScore +=
      result.score;

    /*
     * Count every rule occurrence.
     *
     * Repetition across many posts is
     * important at channel level.
     */

    for (
      const rule of result.triggeredRules
    ) {
      channelRules.add(rule);

      ruleOccurrences.set(
        rule,
        (ruleOccurrences.get(rule) || 0) + 1
      );
    }
  }

  /*
   * ==========================================
   * BASIC POST STATISTICS
   * ==========================================
   */

  const postsCount =
    analyzedPosts.length;

  const suspiciousPosts =
    analyzedPosts.filter(
      (post) =>
        post.suspicious
    );

  const suspiciousPostRatio =
    postsCount > 0
      ? suspiciousPosts.length /
        postsCount
      : 0;

  const averagePostScore =
    postsCount > 0
      ? totalPostScore /
        postsCount
      : 0;

  /*
   * ==========================================
   * CHANNEL SUSPICION SCORE
   *
   * IMPORTANT:
   * We don't just average the posts.
   *
   * Repeated statistical patterns
   * across many posts increase the
   * channel-level score.
   * ==========================================
   */

  let finalSuspicionScore =
    averagePostScore;

  /*
   * ------------------------------------------
   * MANY SUSPICIOUS POSTS
   * ------------------------------------------
   */

  if (
    suspiciousPostRatio >= 0.80
  ) {
    finalSuspicionScore += 4;

    channelRules.add(
      "VERY_HIGH_SUSPICIOUS_POST_RATIO"
    );
  } else if (
    suspiciousPostRatio >= 0.60
  ) {
    finalSuspicionScore += 3;

    channelRules.add(
      "HIGH_SUSPICIOUS_POST_RATIO"
    );
  } else if (
    suspiciousPostRatio >= 0.40
  ) {
    finalSuspicionScore += 2;

    channelRules.add(
      "SUSPICIOUS_POST_PATTERN"
    );
  }

  /*
   * ==========================================
   * REPEATED RULES
   * ==========================================
   *
   * One suspicious post should not dominate.
   *
   * But if the SAME pattern appears repeatedly
   * across many posts, it becomes a stronger
   * statistical signal.
   */

  for (
    const [
      rule,
      occurrences,
    ] of ruleOccurrences.entries()
  ) {
    if (
      occurrences >= 12
    ) {
      finalSuspicionScore += 4;

      channelRules.add(
        `REPEATED_${rule}_VERY_HIGH`
      );
    } else if (
      occurrences >= 8
    ) {
      finalSuspicionScore += 3;

      channelRules.add(
        `REPEATED_${rule}_HIGH`
      );
    } else if (
      occurrences >= 5
    ) {
      finalSuspicionScore += 2;

      channelRules.add(
        `REPEATED_${rule}`
      );
    }
  }

  /*
   * ==========================================
   * VIEW CONSISTENCY PATTERN
   * ==========================================
   *
   * Detect repeated very-similar view counts
   * across multiple posts.
   */

  const similarViewPosts =
    analyzedPosts.filter(
      (post) =>
        post.triggeredRules.includes(
          "VERY_SIMILAR_VIEW_COUNTS"
        )
    ).length;

  if (
    similarViewPosts >= 12
  ) {
    finalSuspicionScore += 5;

    channelRules.add(
      "EXTREME_VIEW_COUNT_CONSISTENCY"
    );
  } else if (
    similarViewPosts >= 8
  ) {
    finalSuspicionScore += 4;

    channelRules.add(
      "HIGH_VIEW_COUNT_CONSISTENCY"
    );
  } else if (
    similarViewPosts >= 5
  ) {
    finalSuspicionScore += 2;

    channelRules.add(
      "REPEATED_VIEW_COUNT_CONSISTENCY"
    );
  }

  /*
   * ==========================================
   * VERY HIGH VIEWER RATIO PATTERN
   * ==========================================
   */

  const highViewerRatioPosts =
    analyzedPosts.filter(
      (post) =>
        post.triggeredRules.includes(
          "VERY_HIGH_VIEWER_RATIO"
        ) ||
        post.triggeredRules.includes(
          "EXTREME_VIEWER_RATIO"
        )
    ).length;

  if (
    highViewerRatioPosts >= 10
  ) {
    finalSuspicionScore += 3;

    channelRules.add(
      "REPEATED_HIGH_VIEWER_RATIO"
    );
  }

  /*
   * ==========================================
   * VERY LOW ENGAGEMENT PATTERN
   * ==========================================
   */

  const lowEngagementPosts =
    analyzedPosts.filter(
      (post) =>
        post.triggeredRules.includes(
          "VERY_LOW_ENGAGEMENT"
        ) ||
        post.triggeredRules.includes(
          "LOW_ENGAGEMENT"
        )
    ).length;

  if (
    lowEngagementPosts >= 10
  ) {
    finalSuspicionScore += 3;

    channelRules.add(
      "REPEATED_LOW_ENGAGEMENT"
    );
  }

  /*
   * ==========================================
   * MULTI-SIGNAL CONFIRMATION
   * ==========================================
   *
   * We require multiple different statistical
   * signals before giving a high suspicion level.
   */

  const independentSignals =
    [
      similarViewPosts >= 5,

      highViewerRatioPosts >= 5,

      lowEngagementPosts >= 5,

      suspiciousPostRatio >= 0.5,

      [...ruleOccurrences.values()]
        .some(
          (count) => count >= 5
        ),
    ].filter(Boolean).length;

  if (
    independentSignals >= 4
  ) {
    finalSuspicionScore += 4;

    channelRules.add(
      "MULTI_SIGNAL_CONFIRMATION"
    );
  } else if (
    independentSignals >= 3
  ) {
    finalSuspicionScore += 3;

    channelRules.add(
      "MULTI_SIGNAL_PATTERN"
    );
  } else if (
    independentSignals >= 2
  ) {
    finalSuspicionScore += 1;

    channelRules.add(
      "MULTIPLE_STATISTICAL_SIGNALS"
    );
  }

  /*
   * ==========================================
   * MINIMUM DATA PROTECTION
   * ==========================================
   *
   * Don't make a strong classification when
   * there isn't enough data.
   */

  if (
    postsCount <
    SCAN_RULES.MIN_POSTS_REQUIRED
  ) {
    finalSuspicionScore = Math.min(
      finalSuspicionScore,
      2
    );

    channelRules.add(
      "INSUFFICIENT_POST_DATA"
    );
  }

  /*
   * ==========================================
   * FINAL CLASSIFICATION
   * ==========================================
   */

  const suspicionLevel =
    getSuspicionLevel(
      finalSuspicionScore
    );

  const suspicious =
    suspicionLevel !== "LOW";

  const quality =
    getQuality(
      finalSuspicionScore
    );

  /*
   * ==========================================
   * RETURN RESULT
   * ==========================================
   */

  return {
    username:
      input.username,

    title:
      input.title,

    subscribers:
      input.subscribers,

    postsAnalyzed:
      postsCount,

    quality:
      quality.quality,

    qualityScore:
      Math.round(
        quality.qualityScore
      ),

    suspicious,

    suspicionLevel,

    suspicionScore:
      Number(
        finalSuspicionScore.toFixed(2)
      ),

    triggeredRules:
      [...channelRules],

    posts:
      analyzedPosts,

    analyzedAt:
      checkedAt.toISOString(),
  };
}