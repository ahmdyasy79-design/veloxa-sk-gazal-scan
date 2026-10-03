"use client";

import { useMemo, useState } from "react";

type RealityLevel =
  | "LOW_RISK"
  | "MEDIUM_RISK"
  | "HIGH_RISK"
  | "INSUFFICIENT_DATA";

type FinalStatus =
  | "GOOD"
  | "SEMI_GOOD"
  | "WEAK"
  | "SUSPICIOUS";

type ScanItem = {
  username: string;
  title: string;
  subscribers: number;
  analysis: any;
  realityAudit: any;
  finalStatus: FinalStatus;
  qualityScore: number;
  suspicionScore: number;
  realityLevel: RealityLevel;
};

function safeNumber(value: any): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function formatNumber(value: any): string {
  return Math.round(safeNumber(value)).toLocaleString("en-US");
}

function getRealityLevel(audit: any): RealityLevel {
  const level = audit?.level;

  if (
    level === "LOW_RISK" ||
    level === "MEDIUM_RISK" ||
    level === "HIGH_RISK" ||
    level === "INSUFFICIENT_DATA"
  ) {
    return level;
  }

  return "INSUFFICIENT_DATA";
}

function getQualityScore(analysis: any): number {
  return Math.round(
    safeNumber(
      analysis?.qualityScore ??
        analysis?.score ??
        0
    )
  );
}

function getSuspicionScore(analysis: any): number {
  return Math.round(
    safeNumber(
      analysis?.suspicionScore ??
        analysis?.suspicion?.score ??
        0
    )
  );
}

function getQualityLevel(analysis: any): string {
  return String(
    analysis?.qualityLevel ??
      analysis?.level ??
      analysis?.classification ??
      "WEAK"
  ).toUpperCase();
}

function getFinalStatus(
  analysis: any,
  realityAudit: any
): FinalStatus {
  const reality = getRealityLevel(realityAudit);

  if (
    reality === "HIGH_RISK" ||
    reality === "MEDIUM_RISK"
  ) {
    return "SUSPICIOUS";
  }

  const suspicion = getSuspicionScore(analysis);

  const analysisSuspicious =
    analysis?.suspicious === true ||
    analysis?.isSuspicious === true ||
    analysis?.suspicion === true ||
    suspicion > 0;

  if (analysisSuspicious) {
    return "SUSPICIOUS";
  }

  const quality = getQualityLevel(analysis);

  if (getQualityScore(analysis) >= 80 || quality.includes("GOOD")) {
    return "GOOD";
  }

  if (getQualityScore(analysis) >= 55 || quality.includes("SEMI")) {
    return "SEMI_GOOD";
  }

  return "WEAK";
}

function normalizeResult(
  data: any,
  username: string
): ScanItem {
  const analysis = data?.analysis ?? {};
  const realityAudit = data?.realityAudit ?? {};

  return {
    username:
      data?.username ??
      username,

    title:
      data?.title ??
      data?.channel?.title ??
      username,

    subscribers: safeNumber(
      data?.subscribers ??
        data?.channel?.subscribers ??
        0
    ),

    analysis,

    realityAudit,

    finalStatus: getFinalStatus(
      analysis,
      realityAudit
    ),

    qualityScore:
      getQualityScore(analysis),

    suspicionScore:
      getSuspicionScore(analysis),

    realityLevel:
      getRealityLevel(realityAudit),
  };
}

function realityLabel(level: RealityLevel): string {
  switch (level) {
    case "HIGH_RISK":
      return "Reality: HIGH RISK";

    case "MEDIUM_RISK":
      return "Reality: MEDIUM RISK";

    case "LOW_RISK":
      return "Reality: LOW RISK";

    default:
      return "Reality: INSUFFICIENT DATA";
  }
}

function realityClass(level: RealityLevel): string {
  switch (level) {
    case "HIGH_RISK":
      return "risk-high";

    case "MEDIUM_RISK":
      return "risk-medium";

    case "LOW_RISK":
      return "risk-low";

    default:
      return "risk-none";
  }
}

function statusClass(status: FinalStatus): string {
  switch (status) {
    case "GOOD":
      return "status-good";

    case "SEMI_GOOD":
      return "status-semi";

    case "SUSPICIOUS":
      return "status-suspicious";

    default:
      return "status-weak";
  }
}

function getSignals(audit: any): string[] {
  if (!Array.isArray(audit?.signals)) {
    return [];
  }

  return audit.signals.map((item: any) =>
    String(item)
  );
}

function getWarnings(audit: any): string[] {
  if (!Array.isArray(audit?.warnings)) {
    return [];
  }

  return audit.warnings.map((item: any) =>
    String(item)
  );
}

export default function Home() {
  const [input, setInput] =
    useState("VELOXAtrd80");

  const [channels, setChannels] =
    useState<ScanItem[]>([]);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [copied, setCopied] =
    useState("");

  const [selected, setSelected] =
    useState<ScanItem | null>(null);

  const goodChannels = useMemo(
    () =>
      channels.filter(
        (item) =>
          item.finalStatus === "GOOD" &&
          item.realityLevel === "LOW_RISK"
      ),
    [channels]
  );

  const badChannels = useMemo(
    () =>
      channels.filter(
        (item) =>
          item.finalStatus === "WEAK" ||
          item.finalStatus === "SUSPICIOUS" ||
          item.realityLevel === "MEDIUM_RISK" ||
          item.realityLevel === "HIGH_RISK"
      ),
    [channels]
  );

  const suspiciousCount = useMemo(
    () =>
      channels.filter(
        (item) =>
          item.finalStatus ===
          "SUSPICIOUS"
      ).length,
    [channels]
  );

  const realityHighCount = useMemo(
    () =>
      channels.filter(
        (item) =>
          item.realityLevel ===
          "HIGH_RISK"
      ).length,
    [channels]
  );

  const realityMediumCount = useMemo(
    () =>
      channels.filter(
        (item) =>
          item.realityLevel ===
          "MEDIUM_RISK"
      ).length,
    [channels]
  );

  const goodCount = channels.filter(
    (item) =>
      item.finalStatus === "GOOD"
  ).length;

  const semiCount = channels.filter(
    (item) =>
      item.finalStatus === "SEMI_GOOD"
  ).length;

  const weakCount = channels.filter(
    (item) =>
      item.finalStatus === "WEAK"
  ).length;

  async function scanChannels() {
    setError("");
    setCopied("");
    setSelected(null);

    const usernames = input
      .split(/\r?\n/)
      .map((item) =>
        item
          .trim()
          .replace(/^@/, "")
      )
      .filter(Boolean);

    if (!usernames.length) {
      setError(
        "Enter at least one Telegram username."
      );
      return;
    }

    setLoading(true);

    const results: ScanItem[] = [];

    try {
      for (const username of usernames) {
        try {
          const response =
            await fetch(
              "/api/channel-scan",
              {
                method: "POST",

                headers: {
                  "Content-Type":
                    "application/json",
                },

                body: JSON.stringify({
                  username,
                }),
              }
            );

          const data =
            await response.json();

          if (!response.ok) {
            throw new Error(
              data?.error ||
                `Failed to scan ${username}`
            );
          }

          results.push(
            normalizeResult(
              data,
              username
            )
          );

          setChannels([
            ...results,
          ]);
        } catch (scanError: any) {
          setError(
            scanError?.message ||
              `Failed to scan ${username}`
          );
        }
      }
    } catch (scanError: any) {
      setError(
        scanError?.message ||
          "Scan failed."
      );
    } finally {
      setLoading(false);
    }
  }

  async function copyChannels(
    items: ScanItem[],
    type: string
  ) {
    if (!items.length) {
      return;
    }

    const text = items
      .map(
        (item) =>
          `@${item.username}`
      )
      .join("\n");

    await navigator.clipboard.writeText(
      text
    );

    setCopied(type);

    setTimeout(() => {
      setCopied("");
    }, 1800);
  }

  return (
    <main className="page">
      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          background: #050608;
          color: #f5f7fa;
          font-family:
            Inter,
            Arial,
            Helvetica,
            sans-serif;
        }

        button,
        textarea {
          font-family: inherit;
        }

        .page {
          min-height: 100vh;
          background:
            radial-gradient(
              circle at 20% 0%,
              rgba(0, 220, 160, 0.08),
              transparent 30%
            ),
            radial-gradient(
              circle at 80% 0%,
              rgba(70, 100, 255, 0.08),
              transparent 30%
            ),
            #050608;
          padding: 32px;
        }

        .container {
          max-width: 1500px;
          margin: auto;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          margin-bottom: 28px;
        }

        .brand {
          font-size: 28px;
          font-weight: 900;
          letter-spacing: -1px;
        }

        .brand span {
          color: #00d7a0;
        }

        .subtitle {
          color: #737b8c;
          margin-top: 6px;
          font-size: 13px;
        }

        .live {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 9px 14px;
          border: 1px solid #202630;
          border-radius: 999px;
          color: #9da6b7;
          background: #0b0d11;
          font-size: 13px;
        }

        .dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #00d7a0;
          box-shadow:
            0 0 12px
              rgba(0, 215, 160, 0.8);
        }

        .scanner {
          background: #0b0d11;
          border: 1px solid #202630;
          border-radius: 20px;
          padding: 20px;
          margin-bottom: 22px;
        }

        .scanner-title {
          font-size: 17px;
          font-weight: 800;
          margin-bottom: 12px;
        }

        .input-row {
          display: flex;
          gap: 12px;
        }

        textarea {
          flex: 1;
          min-height: 100px;
          resize: vertical;
          background: #06080b;
          color: white;
          border: 1px solid #252b35;
          border-radius: 13px;
          padding: 14px;
          outline: none;
          font-size: 14px;
        }

        textarea:focus {
          border-color: #00b88a;
        }

        .scan-button {
          min-width: 150px;
          border: 0;
          border-radius: 13px;
          background: #00c994;
          color: #00150f;
          font-weight: 900;
          cursor: pointer;
          padding: 0 20px;
        }

        .scan-button:hover {
          background: #00e0a5;
        }

        .scan-button:disabled {
          opacity: 0.5;
          cursor: wait;
        }

        .error {
          margin-top: 12px;
          padding: 12px;
          border: 1px solid #63252d;
          background: #18090c;
          color: #ff737d;
          border-radius: 10px;
          font-size: 13px;
        }

        .stats {
          display: grid;
          grid-template-columns:
            repeat(8, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 24px;
        }

        .stat {
          min-height: 105px;
          padding: 17px;
          border-radius: 17px;
          background: #0b0d11;
          border: 1px solid #202630;
        }

        .stat-label {
          color: #6f7b90;
          font-size: 12px;
          margin-bottom: 18px;
        }

        .stat-value {
          font-size: 28px;
          font-weight: 900;
        }

        .green {
          color: #00d7a0;
        }

        .yellow {
          color: #ffc400;
        }

        .red {
          color: #ff5d68;
        }

        .white {
          color: white;
        }

        .folders {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 24px;
        }

        .folder {
          border-radius: 22px;
          padding: 22px;
          min-height: 230px;
        }

        .folder.good {
          border: 1px solid #075b49;
          background:
            linear-gradient(
              180deg,
              rgba(0, 215, 160, 0.04),
              rgba(0, 215, 160, 0.01)
            );
        }

        .folder.bad {
          border: 1px solid #67242b;
          background:
            linear-gradient(
              180deg,
              rgba(255, 70, 80, 0.04),
              rgba(255, 70, 80, 0.01)
            );
        }

        .folder-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .folder-title {
          font-size: 24px;
          font-weight: 900;
          letter-spacing: 2px;
        }

        .folder.good
          .folder-title {
          color: #00d7a0;
        }

        .folder.bad
          .folder-title {
          color: #ff5d68;
        }

        .copy-button {
          background: transparent;
          border: 1px solid #27303b;
          color: #a8b0bf;
          border-radius: 10px;
          padding: 8px 13px;
          cursor: pointer;
        }

        .copy-button:hover {
          border-color: #00c994;
          color: white;
        }

        .folder-empty {
          height: 130px;
          border: 1px solid #171c23;
          border-radius: 16px;
          display: flex;
          justify-content: center;
          align-items: center;
          color: #596274;
          background: #080a0d;
        }

        .channel-list {
          display: grid;
          gap: 10px;
        }

        .channel-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          background: #080a0e;
          border: 1px solid #181e27;
          border-radius: 14px;
          padding: 14px;
          cursor: pointer;
        }

        .channel-row:hover {
          border-color: #37404d;
        }

        .channel-name {
          font-weight: 800;
        }

        .channel-title {
          color: #647085;
          font-size: 12px;
          margin-top: 4px;
        }

        .row-right {
          text-align: right;
        }

        .badge {
          display: inline-block;
          border-radius: 999px;
          padding: 6px 10px;
          font-size: 11px;
          font-weight: 800;
        }

        .status-good {
          color: #00d7a0;
          border: 1px solid #075b49;
          background: #061812;
        }

        .status-semi {
          color: #ffc400;
          border: 1px solid #5c4900;
          background: #171300;
        }

        .status-weak,
        .status-suspicious {
          color: #ff6872;
          border: 1px solid #63252d;
          background: #18090c;
        }

        .details {
          background: #0b0d11;
          border: 1px solid #202630;
          border-radius: 22px;
          padding: 24px;
          margin-bottom: 30px;
        }

        .details-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          padding-bottom: 20px;
          border-bottom: 1px solid #1d232c;
        }

        .details-title {
          font-size: 25px;
          font-weight: 900;
        }

        .details-subtitle {
          color: #647085;
          margin-top: 5px;
        }

        .close {
          border: 1px solid #29303a;
          background: transparent;
          color: #aeb6c3;
          padding: 8px 13px;
          border-radius: 9px;
          cursor: pointer;
        }

        .audit-grid {
          display: grid;
          grid-template-columns:
            repeat(8, minmax(0, 1fr));
          gap: 10px;
          margin-top: 20px;
        }

        .audit-card {
          background: #080a0e;
          border: 1px solid #191f27;
          border-radius: 13px;
          padding: 13px;
        }

        .audit-label {
          color: #69768a;
          font-size: 11px;
          margin-bottom: 9px;
        }

        .audit-value {
          font-size: 17px;
          font-weight: 800;
        }

        .section-title {
          margin-top: 24px;
          margin-bottom: 10px;
          font-size: 14px;
          font-weight: 800;
        }

        .signal-list {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .signal {
          padding: 8px 10px;
          border-radius: 9px;
          background: #11151b;
          border: 1px solid #222a34;
          color: #aab4c4;
          font-size: 11px;
        }

        .warning {
          padding: 9px 11px;
          border-radius: 9px;
          background: #170f03;
          border: 1px solid #4a3505;
          color: #d6b95b;
          font-size: 11px;
          margin-bottom: 7px;
        }

        .risk-high {
          color: #ff606a;
        }

        .risk-medium {
          color: #ffc400;
        }

        .risk-low {
          color: #00d7a0;
        }

        .risk-none {
          color: #8993a4;
        }

        .results-title {
          font-size: 20px;
          font-weight: 900;
          margin: 24px 0 12px;
        }

        .results {
          display: grid;
          gap: 14px;
        }

        .result-card {
          background: #0b0d11;
          border: 1px solid #202630;
          border-radius: 20px;
          overflow: hidden;
        }

        .result-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 18px 20px;
          gap: 20px;
        }

        .result-user {
          font-size: 21px;
          font-weight: 900;
        }

        .result-title {
          color: #667286;
          font-size: 13px;
          margin-top: 4px;
        }

        .result-badges {
          display: flex;
          gap: 7px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .metric-line {
          display: grid;
          grid-template-columns:
            repeat(6, 1fr);
          border-top: 1px solid #1b212a;
        }

        .metric {
          padding: 15px;
          border-right: 1px solid #1b212a;
        }

        .metric:last-child {
          border-right: 0;
        }

        .metric-label {
          color: #657186;
          font-size: 11px;
          margin-bottom: 6px;
        }

        .metric-value {
          font-weight: 800;
        }

        .empty {
          text-align: center;
          padding: 70px 20px;
          color: #566173;
          border: 1px dashed #202630;
          border-radius: 18px;
        }

        @media (max-width: 1100px) {
          .stats {
            grid-template-columns:
              repeat(4, 1fr);
          }

          .audit-grid {
            grid-template-columns:
              repeat(4, 1fr);
          }
        }

        @media (max-width: 800px) {
          .page {
            padding: 16px;
          }

          .header {
            align-items: flex-start;
          }

          .input-row {
            flex-direction: column;
          }

          .scan-button {
            min-height: 50px;
          }

          .folders {
            grid-template-columns: 1fr;
          }

          .stats {
            grid-template-columns:
              repeat(2, 1fr);
          }

          .audit-grid {
            grid-template-columns:
              repeat(2, 1fr);
          }

          .metric-line {
            grid-template-columns:
              repeat(2, 1fr);
          }

          .metric {
            border-bottom: 1px solid #1b212a;
          }
        }
      `}</style>

      <div className="container">

        <header className="header">
          <div>
            <div className="brand">
              VELOXA
              <span> & SK GAZAL SCAN</span>
            </div>

            <div className="subtitle">
              Telegram Channel Intelligence
              & Statistical Reality Audit
            </div>
          </div>

          <div className="live">
            <span className="dot" />
            LIVE MONITOR
          </div>
        </header>

        <section className="scanner">
          <div className="scanner-title">
            Scan Telegram Channels
          </div>

          <div className="input-row">
            <textarea
              value={input}
              onChange={(event) =>
                setInput(
                  event.target.value
                )
              }
              placeholder={
                "VELOXAtrd80\nPRICE_HUNTER_PUPLIC"
              }
            />

            <button
              className="scan-button"
              onClick={scanChannels}
              disabled={loading}
            >
              {loading
                ? "SCANNING..."
                : "SCAN CHANNELS"}
            </button>
          </div>

          {error && (
            <div className="error">
              {error}
            </div>
          )}
        </section>

        <section className="stats">

          <div className="stat">
            <div className="stat-label">
              TOTAL CHANNELS
            </div>

            <div className="stat-value white">
              {channels.length}
            </div>
          </div>

          <div className="stat">
            <div className="stat-label">
              ANALYZED
            </div>

            <div className="stat-value white">
              {channels.length}
            </div>
          </div>

          <div className="stat">
            <div className="stat-label">
              GOOD
            </div>

            <div className="stat-value green">
              {goodCount}
            </div>
          </div>

          <div className="stat">
            <div className="stat-label">
              SEMI GOOD
            </div>

            <div className="stat-value yellow">
              {semiCount}
            </div>
          </div>

          <div className="stat">
            <div className="stat-label">
              WEAK
            </div>

            <div className="stat-value red">
              {weakCount}
            </div>
          </div>

          <div className="stat">
            <div className="stat-label">
              SUSPICIOUS
            </div>

            <div className="stat-value red">
              {suspiciousCount}
            </div>
          </div>

          <div className="stat">
            <div className="stat-label">
              REALITY HIGH
            </div>

            <div className="stat-value red">
              {realityHighCount}
            </div>
          </div>

          <div className="stat">
            <div className="stat-label">
              REALITY MEDIUM
            </div>

            <div className="stat-value yellow">
              {realityMediumCount}
            </div>
          </div>

        </section>

        <section className="folders">

          <div className="folder good">

            <div className="folder-header">
              <div className="folder-title">
                GOOD FOLDER
              </div>

              <button
                className="copy-button"
                onClick={() =>
                  copyChannels(
                    goodChannels,
                    "good"
                  )
                }
              >
                {copied === "good"
                  ? "COPIED ✓"
                  : "COPY ALL"}
              </button>
            </div>

            {goodChannels.length === 0 ? (
              <div className="folder-empty">
                No good channels yet.
              </div>
            ) : (
              <div className="channel-list">
                {goodChannels.map(
                  (item) => (
                    <div
                      className="channel-row"
                      key={item.username}
                      onClick={() =>
                        setSelected(item)
                      }
                    >
                      <div>
                        <div className="channel-name">
                          @{item.username}
                        </div>

                        <div className="channel-title">
                          {item.title}
                        </div>
                      </div>

                      <div className="row-right">
                        <span className="badge status-good">
                          GOOD
                        </span>
                      </div>
                    </div>
                  )
                )}
              </div>
            )}

          </div>

          <div className="folder bad">

            <div className="folder-header">
              <div className="folder-title">
                BAD FOLDER
              </div>

              <button
                className="copy-button"
                disabled
                title="Copy disabled for bad channels"
              >
                COPY DISABLED
              </button>
            </div>

            {badChannels.length === 0 ? (
              <div className="folder-empty">
                No weak or suspicious
                channels.
              </div>
            ) : (
              <div className="channel-list">
                {badChannels.map(
                  (item) => (
                    <div
                      className="channel-row"
                      key={item.username}
                      onClick={() =>
                        setSelected(item)
                      }
                    >
                      <div>
                        <div className="channel-name">
                          @{item.username}
                        </div>

                        <div className="channel-title">
                          {item.title}
                        </div>
                      </div>

                      <div className="row-right">
                        <span
                          className={`badge ${statusClass(
                            item.finalStatus
                          )}`}
                        >
                          {item.realityLevel ===
                          "HIGH_RISK"
                            ? "HIGH RISK"
                            : item.realityLevel ===
                              "MEDIUM_RISK"
                            ? "MEDIUM RISK"
                            : item.finalStatus}
                        </span>
                      </div>
                    </div>
                  )
                )}
              </div>
            )}

          </div>

        </section>

        {selected && (
          <section className="details">

            <div className="details-head">

              <div>
                <div className="details-title">
                  @{selected.username}
                </div>

                <div className="details-subtitle">
                  {selected.title}
                </div>
              </div>

              <button
                className="close"
                onClick={() =>
                  setSelected(null)
                }
              >
                CLOSE
              </button>

            </div>

            <div className="audit-grid">

              <div className="audit-card">
                <div className="audit-label">
                  SUBSCRIBERS
                </div>
                <div className="audit-value">
                  {formatNumber(
                    selected.subscribers
                  )}
                </div>
              </div>

              <div className="audit-card">
                <div className="audit-label">
                  AVERAGE VIEWS
                </div>
                <div className="audit-value">
                  {formatNumber(
                    selected.realityAudit
                      ?.averageViews
                  )}
                </div>
              </div>

              <div className="audit-card">
                <div className="audit-label">
                  MEDIAN VIEWS
                </div>
                <div className="audit-value">
                  {formatNumber(
                    selected.realityAudit
                      ?.medianViews
                  )}
                </div>
              </div>

              <div className="audit-card">
                <div className="audit-label">
                  VIEW RATIO
                </div>
                <div className="audit-value">
                  {(
                    safeNumber(
                      selected.realityAudit
                        ?.medianViewRatio
                    ) * 100
                  ).toFixed(2)}
                  %
                </div>
              </div>

              <div className="audit-card">
                <div className="audit-label">
                  REACTION RATIO
                </div>
                <div className="audit-value">
                  {(
                    safeNumber(
                      selected.realityAudit
                        ?.medianReactionRatio
                    ) * 100
                  ).toFixed(2)}
                  %
                </div>
              </div>

              <div className="audit-card">
                <div className="audit-label">
                  VIEW DISPERSION
                </div>
                <div className="audit-value">
                  {safeNumber(
                    selected.realityAudit
                      ?.viewDispersion
                  ).toFixed(4)}
                </div>
              </div>

              <div className="audit-card">
                <div className="audit-label">
                  VIEW REPETITION
                </div>
                <div className="audit-value">
                  {formatNumber(
                    selected.realityAudit
                      ?.repeatedViewCounts
                  )}
                  /{" "}
                  {formatNumber(
                    selected.realityAudit
                      ?.postsAnalyzed
                  )}
                </div>
              </div>

              <div className="audit-card">
                <div className="audit-label">
                  REACTION REPETITION
                </div>
                <div className="audit-value">
                  {formatNumber(
                    selected.realityAudit
                      ?.repeatedReactionCounts
                  )}
                  /{" "}
                  {formatNumber(
                    selected.realityAudit
                      ?.postsAnalyzed
                  )}
                </div>
              </div>

            </div>

            <div className="section-title">
              REALITY AUDIT
            </div>

            <div
              className={
                realityClass(
                  selected.realityLevel
                )
              }
              style={{
                fontSize: 22,
                fontWeight: 900,
              }}
            >
              {realityLabel(
                selected.realityLevel
              )}
            </div>

            <div
              style={{
                marginTop: 8,
                color: "#788397",
                fontSize: 13,
              }}
            >
              Risk Score:{" "}
              <strong>
                {safeNumber(
                  selected.realityAudit
                    ?.riskScore
                )}
              </strong>
              {" • "}
              Confidence:{" "}
              <strong>
                {safeNumber(
                  selected.realityAudit
                    ?.confidence
                )}
                %
              </strong>
            </div>

            <div className="section-title">
              DETECTED SIGNALS
            </div>

            <div className="signal-list">
              {getSignals(
                selected.realityAudit
              ).length === 0 ? (
                <span className="signal">
                  No statistical signals.
                </span>
              ) : (
                getSignals(
                  selected.realityAudit
                ).map((signal) => (
                  <span
                    className="signal"
                    key={signal}
                  >
                    {signal}
                  </span>
                ))
              )}
            </div>

            <div className="section-title">
              NOTES / WARNINGS
            </div>

            {getWarnings(
              selected.realityAudit
            ).length === 0 ? (
              <div className="warning">
                No warnings.
              </div>
            ) : (
              getWarnings(
                selected.realityAudit
              ).map((warning) => (
                <div
                  className="warning"
                  key={warning}
                >
                  {warning}
                </div>
              ))
            )}

          </section>
        )}

        <div className="results-title">
          SCAN RESULTS
        </div>

        {channels.length === 0 ? (
          <div className="empty">
            Enter Telegram usernames above
            and start the scan.
          </div>
        ) : (
          <section className="results">

            {channels.map((item) => (
              <div
                className="result-card"
                key={item.username}
                onClick={() =>
                  setSelected(item)
                }
                style={{
                  cursor: "pointer",
                }}
              >

                <div className="result-top">

                  <div>
                    <div className="result-user">
                      @{item.username}
                    </div>

                    <div className="result-title">
                      {item.title}
                    </div>
                  </div>

                  <div className="result-badges">

                    <span
                      className={`badge ${statusClass(
                        item.finalStatus
                      )}`}
                    >
                      {item.finalStatus}
                    </span>

                    <span
                      className={`badge ${realityClass(
                        item.realityLevel
                      )}`}
                    >
                      {realityLabel(
                        item.realityLevel
                      )}
                    </span>

                  </div>

                </div>

                <div className="metric-line">

                  <div className="metric">
                    <div className="metric-label">
                      SUBSCRIBERS
                    </div>

                    <div className="metric-value">
                      {formatNumber(
                        item.subscribers
                      )}
                    </div>
                  </div>

                  <div className="metric">
                    <div className="metric-label">
                      QUALITY
                    </div>

                    <div className="metric-value">
                      {item.qualityScore}/100
                    </div>
                  </div>

                  <div className="metric">
                    <div className="metric-label">
                      SUSPICION
                    </div>

                    <div className="metric-value">
                      {item.suspicionScore}
                    </div>
                  </div>

                  <div className="metric">
                    <div className="metric-label">
                      MEDIAN VIEWS
                    </div>

                    <div className="metric-value">
                      {formatNumber(
                        item.realityAudit
                          ?.medianViews
                      )}
                    </div>
                  </div>

                  <div className="metric">
                    <div className="metric-label">
                      RISK SCORE
                    </div>

                    <div className="metric-value">
                      {safeNumber(
                        item.realityAudit
                          ?.riskScore
                      )}
                    </div>
                  </div>

                  <div className="metric">
                    <div className="metric-label">
                      CONFIDENCE
                    </div>

                    <div className="metric-value">
                      {safeNumber(
                        item.realityAudit
                          ?.confidence
                      )}
                      %
                    </div>
                  </div>

                </div>

              </div>
            ))}

          </section>
        )}

      </div>
    </main>
  );
}
