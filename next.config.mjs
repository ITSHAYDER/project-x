/** @type {import('next').NextConfig} */
const nextConfig = {
	async headers() {
		return [{
			source: "/(.*)",
			headers: [
				{ key: "X-Content-Type-Options", value: "nosniff" },
				{ key: "X-Frame-Options", value: "DENY" },
				{ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
				{ key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
				{ key: "Content-Security-Policy", value: "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; connect-src 'self' https://*.supabase.co https://generativelanguage.googleapis.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" },
			],
		}];
	},
};

export default nextConfig;
