import { Link } from "react-router-dom";

export function HomePage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-12 text-center">
      <h1 className="text-2xl font-semibold text-gray-900 mb-2">
        Diagnostic Assistant
      </h1>
      <p className="text-clinical-muted mb-8">
        Real-time encounter capture and AI-assisted diagnosis. Start an encounter to see live transcription and post-visit analysis.
      </p>
      <Link
        to="/encounter"
        className="inline-flex items-center justify-center rounded-lg bg-clinical-primary text-white px-6 py-3 font-medium hover:bg-clinical-primaryHover transition"
      >
        Start encounter
      </Link>
    </div>
  );
}
