"use client";

export default function FloatingDecor() {
  return (
    <div className="float-layer" aria-hidden="true">
      <span className="float-box box-a" />
      <span className="float-box box-b" />
      <span className="float-box box-c" />
      <span className="float-box box-d" />
      <span className="float-box box-e" />
    </div>
  );
}
