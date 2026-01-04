"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { request } from "../../lib/api";
import { getApiKey, setApiKey } from "../../lib/storage";

export default function FilesPage() {
  const [apiKey, setApiKeyState] = useState("");
  const [uploads, setUploads] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setApiKeyState(getApiKey());
  }, []);

  const authHeader = () => ({ Authorization: `Bearer ${apiKey}` });

  const loadUploads = async () => {
    setError("");
    try {
      const { data } = await request("/data/uploads", {
        headers: authHeader()
      });
      setUploads(data.uploads || []);
    } catch (err) {
      setError(err.message || "Failed to load uploads.");
    }
  };

  useEffect(() => {
    if (apiKey) loadUploads();
  }, [apiKey]);

  const handleApiKeySave = () => {
    setApiKey(apiKey);
    setMessage("API key saved. Loading uploads...");
    loadUploads();
  };

  const handleUpload = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    const file = event.target.elements.file.files[0];
    if (!file) {
      setError("Select a CSV file.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://badapi.fly.dev"}/data/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`
        },
        body: new FormData(event.target)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Upload failed.");
      }

      setMessage("Upload complete.");
      event.target.reset();
      await loadUploads();
    } catch (err) {
      setError(err.message || "Upload failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadLink = async (fileId) => {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const { data } = await request(`/data/upload/${fileId}/link`, {
        method: "POST",
        headers: authHeader()
      });
      setMessage(`Download link: ${data.download_link}`);
    } catch (err) {
      setError(err.message || "Failed to create download link.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (fileId) => {
    setLoading(true);
    setError("");
    try {
      await request(`/data/upload/${fileId}`, {
        method: "DELETE",
        headers: authHeader()
      });
      setMessage("File deleted.");
      await loadUploads();
    } catch (err) {
      setError(err.message || "Delete failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="section">
      <div className="panel">
        <h2>File Management</h2>
        <p className="muted">Set your API key to manage uploads and downloads.</p>
        {!apiKey && (
          <div className="alert">
            No API key yet. <Link href="/keys">Create or paste one</Link>.
          </div>
        )}
        <div className="form">
          <input
            className="input mono"
            placeholder="API Key"
            value={apiKey}
            onChange={(event) => setApiKeyState(event.target.value)}
          />
          <button className="btn secondary" type="button" onClick={handleApiKeySave}>
            Save API Key
          </button>
        </div>
      </div>

      <div className="panel">
        <h3>Upload CSV</h3>
        <form className="form" onSubmit={handleUpload}>
          <input className="input" name="file" type="file" accept=".csv" />
          <button className="btn" type="submit" disabled={loading || !apiKey}>
            {loading ? "Uploading..." : "Upload"}
          </button>
        </form>
        {message && <div className="alert success">{message}</div>}
        {error && <div className="alert">{error}</div>}
      </div>

      <div className="panel">
        <h3>Uploads</h3>
        <button className="btn secondary" type="button" onClick={loadUploads} disabled={!apiKey}>
          Refresh
        </button>
        <table className="table">
          <thead>
            <tr>
              <th>File</th>
              <th>Rows</th>
              <th>Columns</th>
              <th>Uploaded</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {uploads.map((upload) => (
              <tr key={upload.file_id}>
                <td>{upload.filename}</td>
                <td>{upload.row_count}</td>
                <td>{upload.column_count}</td>
                <td>{upload.uploaded_at ? new Date(upload.uploaded_at).toLocaleString() : "—"}</td>
                <td>
                  <div className="actions">
                    <button className="btn secondary" type="button" onClick={() => handleDownloadLink(upload.file_id)}>
                      Link
                    </button>
                    <button className="btn secondary" type="button" onClick={() => handleDelete(upload.file_id)}>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!uploads.length && (
              <tr>
                <td colSpan="5" className="muted">
                  No uploads yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
