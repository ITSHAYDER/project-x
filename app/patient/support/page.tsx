import Link from 'next/link';

// Static, deterministic. No AI in this path. CONFIGURE resources for your region before real use,
// and have a qualified clinician review this text.
export default function Support() {
  return (
    <div>
      <h1 className="font-serif text-2xl">You are not alone with this</h1>
      <p className="mt-3 font-serif text-lg">
        If you might act on thoughts of harming yourself, or you are in danger right now, please contact your local emergency number or go to the nearest emergency service. If you can, tell someone near you.
      </p>
      <p className="mt-3">
        A directory of crisis lines by country is at <a className="underline" href="https://findahelpline.com" rel="noreferrer noopener">findahelpline.com</a>. Your clinician can also help you build a plan for hard moments.
      </p>
      <p className="mt-3 text-sm text-muted">
        Project X is not monitored in real time and cannot respond to emergencies. What you wrote has been saved privately.
      </p>
      <p className="mt-6"><Link className="btn" href="/patient/today">Back to Today</Link></p>
    </div>
  );
}
