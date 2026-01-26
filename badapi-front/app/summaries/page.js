"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { request } from "../../lib/api";
import { getApiKey, getApiKeys, saveApiKey, setApiKey } from "../../lib/storage";
import MarkdownView from "../../components/MarkdownView";

export default function SummariesPage() {
  const [apiKey, setApiKeyState] = useState("");
  const [savedKeys, setSavedKeys] = useState([]);
  const [newKey, setNewKey] = useState("");
  const [uploads, setUploads] = useState([]);
  const [summaries, setSummaries] = useState([]);
  const [fileId, setFileId] = useState("");
  const [selectedSummary, setSelectedSummary] = useState(null);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setApiKeyState(getApiKey());
    setSavedKeys(getApiKeys());
  }, []);

  const authHeader = () => ({ Authorization: `Bearer ${apiKey}` });

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

  const handleSelectKey = (value) => {
    setApiKeyState(value);
    setApiKey(value);
  };

  const loadUploads = async () => {
    try {
      const { data } = await request("/data/uploads", { headers: authHeader() });
      setUploads(data.uploads || []);
      if (!fileId && data.uploads?.length) {
        setFileId(data.uploads[0].file_id);
      }
    } catch (err) {
      setError(err.message || "Failed to load uploads.");
    }
  };

  const loadSummaries = async () => {
    try {
      const { data } = await request("/analysis/summaries", { headers: authHeader() });
      setSummaries(data.summaries || []);
    } catch (err) {
      setError(err.message || "Failed to load summaries.");
    }
  };

  useEffect(() => {
    if (apiKey) {
      loadUploads();
      loadSummaries();
    }
  }, [apiKey]);

  const handleSummarize = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const { data } = await request("/analysis/ai-summary", {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify({ file_id: fileId })
      });
      setMessage(`Summary created. Cached: ${data.cached ? "yes" : "no"}.`);
      await loadSummaries();
    } catch (err) {
      setError(err.message || "Summary failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleViewSummary = async (summaryId) => {
    setLoading(true);
    setError("");
    try {
      const { data } = await request(`/analysis/summary/${summaryId}`, {
        headers: authHeader()
      });
      setSelectedSummary(data);
    } catch (err) {
      setError(err.message || "Failed to load summary.");
    } finally {
      setLoading(false);
    }
  };

  const filteredSummaries = summaries.filter((summary) =>
    `${summary.filename} ${summary.model}`.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <section className="section">
      <div className="panel">
        <h2>AI Summaries</h2>
        <p className="muted">Pick an API key and generate a summary from an upload.</p>
        {!apiKey && (
          <div className="alert">
            No active API key. <Link href="/keys">Create or paste one</Link>.
          </div>
        )}
        <div className="form">
          <select className="select" value={apiKey} onChange={(event) => handleSelectKey(event.target.value)}>
            <option value="">Select saved API key</option>
            {savedKeys.map((key) => (
              <option key={key.raw} value={key.raw}>
                {key.label || "Key"} • {key.last4}
              </option>
            ))}
          </select>
          <div className="inline">
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
        <form className="form" onSubmit={handleSummarize}>
          <select className="select" value={fileId} onChange={(event) => setFileId(event.target.value)}>
            <option value="">Select upload</option>
            {uploads.map((upload) => (
              <option key={upload.file_id} value={upload.file_id}>
                {upload.filename} ({upload.row_count} rows)
              </option>
            ))}
          </select>
          <button className="btn" type="submit" disabled={loading || !fileId || !apiKey}>
            {loading ? "Running..." : "Generate Summary"}
          </button>
        </form>
        {message && <div className="alert success">{message}</div>}
        {error && <div className="alert">{error}</div>}
      </div>

      <div className="panel">
        <h3>Recent Summaries</h3>
        <input
          className="input"
          placeholder="Search summaries"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <table className="table">
          <thead>
            <tr>
              <th>File</th>
              <th>Model</th>
              <th>Created</th>
              <th>Tokens</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filteredSummaries.map((summary) => (
              <tr key={summary.summary_id}>
                <td>{summary.filename}</td>
                <td>{summary.model}</td>
                <td>{summary.created_at ? new Date(summary.created_at).toLocaleString() : "—"}</td>
                <td className="mono">{summary.tokens_used ? JSON.stringify(summary.tokens_used) : "—"}</td>
                <td>
                  <button
                    className="btn secondary"
                    type="button"
                    onClick={() => handleViewSummary(summary.summary_id)}
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
            {!filteredSummaries.length && (
              <tr>
                <td colSpan="5" className="muted">
                  No summaries yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedSummary && (
        <div className="panel">
          <h3>Summary Detail</h3>
          <p className="muted">
            {selectedSummary.filename} • {selectedSummary.model}
          </p>
          <MarkdownView content={selectedSummary.summary} />
        </div>
      )}
    </section>
  );
}
