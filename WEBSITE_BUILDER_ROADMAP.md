# ClubOS website builder roadmap

Clubs either keep their own website and link to ClubOS (works today, see
[WEBSITE_INTEGRATION.md](WEBSITE_INTEGRATION.md)) or build one in ClubOS.
The Ambassadors FC website is not replaced or migrated without explicit approval.

## Today

- `/club-website` starter (from PR #30): an opt-in, static, operator-configured
  page from `VITE_CLUB_PUBLIC_SITE_JSON`. It renders only explicitly configured
  public text. It is a placeholder, not the builder.
- Feature key `websiteBuilder` exists in the plan catalogue (Complete package).

## Design

- **Separate public renderer.** Public sites are served by their own
  deployment, not the member app, so the public surface never ships member
  code or member queries.
- **Public read model.** The club backend publishes approved content into
  public tables/views (`site_pages`, `site_versions`, `public_fixtures`,
  `public_results`, `public_news`, `public_teams`, `site_media`). Anonymous read
  is allowed only on those. Private tables are never queried by the renderer.
- **Approval.** Every external publish is a version created by an admin with
  explicit approval. Auto-publish only where the club configures it per content
  type (e.g. official COMET fixtures).
- **Children.** No children's names, photos or schedules unless the club marks
  the item as consented. Default team pages show the team, coaches who opted in,
  and the public fixture list, not squads.

## Templates

Matchday (bold, football), Academy (development), Community (family), Elite
(premium). Each is a set of section components driven by the same JSON page
schema, so content survives a template change.

## Editor (no code)

Logo, colours, fonts, homepage layout, hero images, navigation, page content,
sponsors, contact, social links, galleries, image cropping with focal points
(reuse the team photo focal-point model), desktop and mobile preview, drafts,
publish, version history and rollback.

## Standard pages

Home, About, Teams, Fixtures, Results, News, Join the club, Camps and events,
Sponsors, Contact, Policies, Member login (links to the club's ClubOS entry
link).

## Hosting

`<club>.clubos.site` subdomains by default; custom domains with automatic SSL
(Vercel domains API); SEO metadata, sitemaps, Open Graph images, accessibility
checks and image optimisation.

## Order of work (Phase 4)

1. Page schema and public read-model migrations, with anonymous-access tests.
2. Renderer with one template (Community) reading the read model.
3. Editor: pages, branding, preview, publish, history.
4. Live fixtures, results and approved match reports.
5. Remaining templates, sponsors, galleries, domains.
