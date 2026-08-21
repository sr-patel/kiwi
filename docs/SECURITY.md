# LAN security

Kiwi is a single-user, self-hosted application and does not provide authentication. Anyone who can reach port 3000 can browse the indexed library, change configuration, or trigger maintenance operations.

- Bind or firewall port 3000 to trusted LAN interfaces only.
- Do not publish backend port 3001.
- Keep Eagle mounts read-only and keep `/app/data` private.
- Never expose Kiwi directly to the public internet. Put an authenticated TLS reverse proxy or VPN in front of it.
- Restrict proxy request sizes and preserve `X-Request-ID` for troubleshooting.
- Back up `/app/data` and protect it as sensitive metadata.

Production deliberately omits raw-library serving and development debug/test endpoints. Same-origin requests are used in production; explicit origins are allowed only for local development.
