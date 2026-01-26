"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { request } from "../../lib/api";
import { getApiKey, getApiKeys, saveApiKey, setApiKey } from "../../lib/storage";

export default function DashboardPage() {
  const [apiKey, setApiKeyState] = useState("");
  const [savedKeys, setSavedKeys] = useState([]);
  const [uploads, setUploads] = useState([]);
  const [summaries, setSummaries] = useState([]);
  const [newKey, setNewKey] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setApiKeyState(getApiKey());
    setSavedKeys(getApiKeys());
  }, []);

  const authHeader = () => ({ Authorization: `Bearer ${apiKey}` });

  const loadStats = async () => {
    if (!apiKey) return;
    try {
      const [uploadsRes, summariesRes] = await Promise.all([
        request("/data/uploads", { headers: authHeader() }),
        request("/analysis/summaries", { headers: authHeader() })
      ]);
      setUploads(uploadsRes.data.uploads || []);
      setSummaries(summariesRes.data.summaries || []);
    } catch (err) {
      setError(err.message || "Failed to load dashboard data.");
    }
  };

  useEffect(() => {
    loadStats();
  }, [apiKey]);

  const handleSelectKey = (value) => {
    setApiKeyState(value);
    setApiKey(value);
  };

  const handleSaveKey = () => {
    if (!newKey) return;
    const entry = {
      raw: newKey,
      label: "Imported key",
      last4: newKey.slice(-4),
      savedAt: new Date().toISOString()
    };
    setSavedKeys(saveApiKey(entry));
    setApiKey(newKey);
    setApiKeyState(newKey);
    setNewKey("");
  };

  const recentUploads = uploads.slice(0, 5);
  const recentSummaries = summaries.slice(0, 5);

  return (
    <section className="section">
      <div className="panel">
        <h2>Dashboard</h2>
        <p className="muted">Overview of uploads, summaries, and key usage.</p>
        {error && <div className="alert">{error}</div>}
        <div className="inline">
          <select className="select" value={apiKey} onChange={(event) => handleSelectKey(event.target.value)}>
            <option value="">Select saved API key</option>
            {savedKeys.map((key) => (
              <option key={key.raw} value={key.raw}>
                {key.label || "Key"} • {key.last4}
              </option>
            ))}
          </select>
          <input
            className="input mono"
            placeholder="Paste API key"
            value={newKey}
            onChange={(event) => setNewKey(event.target.value)}
          />
          <button className="btn secondary" type="button" onClick={handleSaveKey}>
            Save
          </button>
        </div>
      </div>

      <div className="grid">
        <div className="card">
          <div className="card-title">Uploads</div>
          <div className="card-value">{uploads.length}</div>
          <div className="card-meta">Total files uploaded</div>
        </div>
        <div className="card">
          <div className="card-title">Summaries</div>
          <div className="card-value">{summaries.length}</div>
          <div className="card-meta">AI summaries generated</div>
        </div>
        <div className="card">
          <div className="card-title">Rate limit</div>
          <div className="card-value">5k/day</div>
          <div className="card-meta">General API quota</div>
        </div>
      </div>

      <div className="grid">
        <div className="panel">
          <div className="row space">
            <h3>Recent uploads</h3>
            <Link href="/files" className="link">Manage files</Link>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>File</th>
                <th>Rows</th>
                <th>Uploaded</th>
              </tr>
            </thead>
            <tbody>
              {recentUploads.map((upload) => (
                <tr key={upload.file_id}>
                  <td>{upload.filename}</td>
                  <td>{upload.row_count}</td>
                  <td>{upload.uploaded_at ? new Date(upload.uploaded_at).toLocaleString() : "—"}</td>
                </tr>
              ))}
              {!recentUploads.length && (
                <tr>
                  <td colSpan="3" className="muted">
                    No uploads yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="panel">
          <div className="row space">
            <h3>Recent summaries</h3>
            <Link href="/summaries" className="link">View summaries</Link>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>File</th>
                <th>Model</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {recentSummaries.map((summary) => (
                <tr key={summary.summary_id}>
                  <td>{summary.filename}</td>
                  <td>{summary.model}</td>
                  <td>{summary.created_at ? new Date(summary.created_at).toLocaleString() : "—"}</td>
                </tr>
              ))}
              {!recentSummaries.length && (
                <tr>
                  <td colSpan="3" className="muted">
                    No summaries yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
