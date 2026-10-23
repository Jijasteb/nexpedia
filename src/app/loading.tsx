export default function Loading() {
  return (
    <main className="container loading-page" aria-label="Memuat halaman" aria-busy="true">
      <div className="loading-line loading-line-short" />
      <div className="loading-line loading-line-title" />
      <div className="loading-line loading-line-copy" />
      <div className="loading-grid">
        <div className="loading-card" />
        <div className="loading-card" />
        <div className="loading-card" />
      </div>
    </main>
  );
}
