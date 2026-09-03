# Dental Practice Management Software and Small-Business Risk-Management Platforms

**Research report v3 — revised September 2, 2026 (v2 incorporated three research files produced by Grok; v3 deepens Part B on risk-management platforms, which Grok's files did not cover) (01-rankings-and-features, 02-voice-of-dentists, 03-well-vs-poorly), each dated September 2, 2026.**

## How to read this report

Every figure carries one of five labels:

| Label | Meaning |
|---|---|
| **Verified (primary)** | Read directly from the vendor's own published page or a primary document on the date stated. |
| **Vendor-reported** | A claim the vendor made in a press release or profile. Real, but unaudited and scoped by the vendor. |
| **Third-party estimate** | A figure from a comparison site, IT-support firm, or procurement dataset. Useful, not authoritative. |
| **Anecdotal** | Practitioner statements from Reddit, DentalTown, Capterra, G2, Software Advice, or Facebook groups, usually quoted second-hand by an aggregator. |
| **Grok-reported** | A claim from the Grok files that I could not re-verify because the source page blocks automated access (Dentaltown, Patterson) or was not re-fetched. Grok's own sourcing discipline was sound, so treat these as probable but unconfirmed. |

Reddit blocks direct retrieval from this research environment, and so do Dentaltown, Capterra's directory, and G2's category page. Complaint data therefore comes from aggregators that quote r/Dentistry and DentalTown threads (RevUp Dental, PracticeSignal, the Dentaltown reprint of RevUp) and from Software Advice review pages Grok retrieved directly.

## What changed from v1

| Topic | v1 (my research) | Grok files | v2 resolution |
|---|---|---|---|
| Ranking method | Vendor counts + IT-firm consensus | Same anchor (Medix), plus commercial-status filter (sunset products excluded) and Townie vote as a weak cross-check | Adopted Grok's commercial-status filter; kept my product-family grouping for Carestream (see A.2) |
| Curve rank | #6, inferred from "80,000+ professionals" | #6, same inference plus CEO's "~20% of cloud market" claim | **Confirmed by new primary evidence:** Curve's Aug 27, 2026 release states 6,000+ practice locations |
| Curve pricing page | Two tiers (Hero, SuperHero); imaging only in SuperHero | Read the table as listing imaging in the "included" column; flagged a conflict with reviews | **Grok misread a two-column table.** Hero excludes native imaging; SuperHero includes it. No conflict. |
| Curve public price fragment | None found | "Fee includes all your locations… additional fee of $100 per dentist" on why-curve-rocks | Grok-reported; page not re-fetched. Consistent with Curve's location-inclusive positioning. |
| CareStack footprint | 2,500+ practices (landing page); 1,500+ (Straumann page) | 3,000+ practices (product page) | Four vendor figures now exist, including "2,000+ dentists / 25,000+ active users" on CareStack's Curve comparison page. Report the range. |
| Easy Dental | Listed in the bubble as an HS1 budget tier | Support ended December 31, 2023; migration path is Dentrix | **Corrected:** removed from consideration; corroborated by two third-party listings |
| Carestream family | One family entry at #8 | Three slots: SoftDent #8, PracticeWorks #9, Sensei Cloud #10; PracticeWorks no longer sold to new customers | Kept the family entry; recorded that PracticeWorks is closed to new customers (Grok-reported, gosensei.com) |
| Open Dental fee lines | Live page: on-site training $3,650/$1,200; AI imaging $199; ODMobile $35 | $4,325/day; AI $149; ODMobile $30 (same as Medix) | **Unresolved.** Two independent readers report the higher training and lower AI figures; my fetch returned the other set. One of us hit a cached variant. Confirm on the page before relying on either. |
| Open Dental support | Fee page says the monthly fee includes telephone support | Fee page: phone/chat/email support included, two issues per call | Agree; RevUp's "no live support without a paid plan" claim stays rejected |
| Denticon count | 15,000+ (Synchrony release, Feb 2026) | 13,000+ (Denticon product page); 14,500 all Planet DDS (Jan 28, 2026 release) | Use 13,000+ for Denticon alone; 14,500 for Planet DDS; note the 15,000+ outlier |
| Dentrix count | 48,000 combined with Ascend | 35,000+ on dentrix.com; 48,000 combined | Both HS1 figures; 35,000+ corroborated on Capterra's Dentrix listing |
| Dentaltown Townie Choice 2025 | Not found | n=358: Dentrix 25%, Open Dental 20%, Eaglesoft 15%, Ascend 5%, Curve 4% | New; Grok-reported (Dentaltown blocks fetching); Dentrix's 24th consecutive win appears on dentrix.com |
| Demand-side surveys | None | ADA HPI Q1/Q4 2025, Dental Economics–Levin 2025, KLAS, Forrester TEI, Alta Voice, DentalPost | New; ADA Q4 2025 and Levin verified via Becker's Dental and Dental Economics |
| Curve ownership | Battery Ventures (Curve about page) | Battery Ventures; PracticeSignal separately says Clearlake | Unverified conflict; neither of us fetched a cap-table source |
| Eaglesoft commercial model | Subscription migration reported by third parties | Service Club tiers (Base, Starter, Foundations, Professional, Growth) with 24-month enrollment; version 25.00 (May 2026) | Grok-reported (Patterson blocks fetching); Patterson's support flyer confirms non-members pay $45 per 15 minutes |

---

# Part A — Dental Practice Management Software (PMS)

## A.1 The state of market data

No measured, public market-share data exists for U.S. dental PMS. Medix Dental IT (July 31, 2026) traced the circulating shares — Dentrix 18–22%, Eaglesoft 15–20%, Open Dental 14–18% — to SEO listicles and syndicated press releases with no survey, panel, or methodology, and Grok reached the same conclusion independently and added that the Future Market Insights ranges sum past 100% of a single market. Technographic databases report Open Dental counts in the hundreds and list Microsoft as a user; they do not measure server-based installs.

**Measured (ADA Health Policy Institute):** 16.1% of U.S. dentists were DSO-affiliated in 2024 (26.5% of those ≤10 years out of school; 9.1% of those >25 years out), from a database covering 198,117 of 212,459 practicing dentists. HPI does not track software brands.

**Vendor-reported practice counts (the only hard adoption numbers):**

| Claim | Source and date | Status |
|---|---|---|
| Dentrix: 35,000+ practices | dentrix.com; Capterra listing ("over 35,000 teams") | Vendor-reported |
| Dentrix + Dentrix Ascend: >48,000 U.S. practices; 90% of top-50 DSOs; ~100M claims/year | HS1 releases Aug 2025 – Mar 2026 | Vendor-reported (family total; not split) |
| Ascend installs tripled since Jan 2025; ~600 practices migrated from competitors in 12 months; "80k+ clinicians/staff trust Ascend" | HS1 Dec 2025, Jun 2026; dentrixascend.com | Vendor-reported (people, not practices) |
| Eaglesoft: "nearly 30,000 users"; 55+ authorized integrations; version 25.00 | Patterson page and support site, 2026 | Vendor-reported (unit is "users") |
| Open Dental: "thousands of customers" | opendental.com HIPAA page | Vendor floor, not a count; the ">12,000 installs" figure elsewhere is unsourced |
| Denticon: 13,000+ dental practices | planetdds.com/denticon | Vendor-reported (product page) |
| Planet DDS: 14,500 practices, 175,000 users (all platforms); more 100+-location DSOs than any other cloud PMS | Planet DDS release, Jan 28, 2026 | Vendor-reported (Denticon + Cloud 9 + Apteryx) |
| Denticon 15,000+; Cloud 9 2,500+ ortho practices | Synchrony / Planet DDS release, Feb 18, 2026 | Vendor-reported; the 15,000+ exceeds the corporate total and looks like loose drafting |
| **Curve: 6,000+ dental practice locations across North America; approaching $100M ARR; ~20% of the cloud dental practice market; 80,000+ professionals; 4,000+ conversions** | Curve releases Aug 20 and Aug 27, 2026; curvedental.com | Vendor-reported; the location count is new and the strongest Curve footprint evidence available |
| Curve CEO: 85% of ~160,000 North American practices still on client-server systems; predicts >40% of PMS vendors gone in 36–48 months | Curve release Aug 20, 2026 | Vendor advocacy, not a census; more plausible than ">80% cloud" claims |
| CareStack: 3,000+ practices (product page); 2,500+ (landing page); 1,500+ (Straumann page); "2,000+ dentists, 25,000+ active users" (Curve comparison page) | Various CareStack pages, 2026 | Vendor-reported; four figures in circulation |
| Carestream: "input of more than 20,000 customers from every dental specialty" | Sensei Cloud landing page (undated) | Describes legacy-franchise design input, not current Sensei Cloud installs |
| Oryx: ~2,000 dentists worldwide | RevUp Dental | Third-party estimate |
| Easy Dental: support ended December 31, 2023; migration path is Dentrix | easydental.com (Grok); corroborated by SoftwareFinder and Extruct listings | Product sunset |
| PracticeWorks: no longer sold to new customers; existing users supported | gosensei.com (Grok-reported) | Product closed to new business |

**Ownership (verified by Medix, July 2026, with Grok concurring):** Henry Schein One (Henry Schein / Internet Brands JV) owns Dentrix, Dentrix Ascend, Dentrix Enterprise, and the sunset Easy Dental. Patterson Companies (private since April 17, 2025, Patient Square Capital) owns Eaglesoft and Fuse. Planet DDS (Aquiline Capital Partners recap, 2022) owns Denticon, Cloud 9, and Apteryx. Carestream Dental's software business (Sensei Cloud, SoftDent, PracticeWorks, OrthoTrac, WinOMS) was recapitalized in September 2024 by a General Atlantic Credit-led group. CareStack is independent with a Straumann minority stake (July 2022). Open Dental is independent and privately held. Curve Dental (legal entity CD Newco, LLC; Alpharetta, GA; CEO Dave Cormack) reports Battery Ventures backing since 2018; PracticeSignal separately names Clearlake — unverified. Dovetail is out of business (PitchBook).

## A.2 Estimated top 11 by U.S. use

Method (adopting Grok's refinements): rank by vendor-reported counts adjusted for unit and scope; corroborate with independent IT-firm consensus; exclude products no longer sold or supported; use review volume and the Townie vote only as weak cross-checks. Ranks 1–3 are high confidence; 4–6 moderate; 7–11 low and best read as a tier.

| # | Platform | Owner | Deployment | Evidence for rank | Confidence |
|---|---|---|---|---|---|
| 1 | **Dentrix** | Henry Schein One | On-premise Windows/SQL; cloud imaging and eServices | 35,000+ practices (vendor); dominant share of the 48,000 family total; Townie winner 24 years running (Grok-reported) | High |
| 2 | **Eaglesoft** | Patterson | On-premise; physical server required; Eaglesoft Mobile view-only | "Nearly 30,000 users"; consistently called Dentrix's closest competitor; Townie 15% | High |
| 3 | **Open Dental** | Open Dental Software | Self-hosted default; Open Dental Cloud (U.S. only) | No count published; "thousands of customers"; Townie 20% (second); most-endorsed on r/Dentistry and DentalTown | High (rank), low (count) |
| 4 | **Denticon** | Planet DDS | Cloud (built as a web platform, 2003) | 13,000+ practices (product page); leading 100+-location DSO footprint; Eastern Dental (20 NJ locations) left Dentrix Enterprise for Denticon in Aug 2025 | Moderate |
| 5 | **Dentrix Ascend** | Henry Schein One | Cloud (distinct codebase from Dentrix) | No product count; installs tripled since Jan 2025; Smile Brands, MB2, 42 North, Tend expanding; Townie 5% | Moderate |
| 6 | **Curve Dental (Curve Hero / Curve SuperHero)** | Curve Dental (CD Newco) | Cloud (Chrome on PC or Mac; AWS); Curve Mobile app | **6,000+ practice locations** (Aug 27, 2026); 80,000+ professionals; 4,000+ conversions; ~20% of cloud market (vendor); Townie 4% | Moderate → high on rank |
| 7 | **CareStack** | CareStack (Straumann minority) | Cloud | 1,500–3,000+ practices depending on page; 2,000+ dentists; highest review-site stars; KLAS First Look n=8 | Low |
| 8 | **Carestream / Sensei family** — SoftDent, PracticeWorks, OrthoTrac, WinOMS (server) and Sensei Cloud (cloud) | Carestream Dental | Mixed | Large legacy base; PracticeWorks closed to new customers; SoftDent supported; Sensei Cloud is the successor with no published count; Townie SoftDent 2%, PracticeWorks 1% | Low |
| 9 | **Cloud 9** (orthodontic) | Planet DDS | Cloud | 2,500+ ortho practices; specialty-only | Low |
| 10 | **tab32** (Alpine / Summit) | tab32 | Cloud (Google Cloud) | On every 2026 third-party list; Alpine tier published at $125/month; Townie 0% | Low |
| 11 | **DentiMax** | DentiMax | Server or cloud; Windows only | Publishes pricing; bundled imaging; Townie 1% | Low |

**Where Grok and I diverge on ranks 8–11.** Grok fills 8, 9, and 10 with SoftDent, PracticeWorks, and Sensei Cloud as separate products and leaves Cloud 9, tab32, and DentiMax as honorable mentions. I keep the Carestream products as one family because two of the three are maintenance-mode or closed, and splitting them would push active products with published prices out of the list. Neither approach rests on a practice census; both are defensible.

**Bubble (plausible top-15):** Fuse (Patterson cloud, 2018), Oryx, Archy, Practice-Web (Software Advice FrontRunner 2026), iDentalSoft, MacPractice DDS, Dentrix Enterprise (DSO edition; Eastern Dental cited it as approaching end-of-life), Dolphin (ortho), XLDent, ABELDent, ClearDent, Tracker (Canada, CDAnet-native).

## A.3 Common features and a feature-inventory snapshot

All eleven cover scheduling, patient records, restorative and perio charting, treatment planning, ledger and statements, insurance eligibility and electronic claims, recall, reporting, imaging (native or bridged), patient communication (native or add-on), ePrescribing (usually per-prescriber), a patient portal, role-based permissions, and an audit trail. Grok's file 01 holds the full per-product inventories (scheduling, clinical, imaging and sensor lists, billing, payments, reporting, communication, eRx, multi-location, integrations, mobile, security, AI, pricing, included-vs-separate). The snapshot below extracts the dimensions that decide fit.

| Platform | Native imaging | Clearinghouse in base | Comms in base | eRx | AI (native / partner) | Security claims | Mobile | Offline |
|---|---|---|---|---|---|---|---|---|
| Dentrix | Dentrix Imaging (150+ devices; may be licensed separately); Smart Image | eClaims add-on | Add-on (texting, forms; Lighthouse 360 sister product) | Not documented on 2026 pages | Voice Notes (Ambient sold separately), Detect AI (VideaHealth), Digital Forms AI, Claire | Image audit trail; backups are practice IT | No full browser PMS | Server keeps running |
| Eaglesoft | Advanced Imaging included; Sidexis/DEXIS native; Dolphin 3D tools | Insurance eService is a plan add-on | Plan-tiered (Foundations reminders/text; Professional recall/scheduling; Growth phones) | Starter-plan choice vs. Insurance | Partners: Pearl, Weave AI receptionist, Bola | Practice owns server and backups | Eaglesoft Mobile, view-only | Server keeps running |
| Open Dental | Imaging module + hundreds of bridges; DICOM export; vendor says no separate imaging software needed | 20+ clearinghouses; claim fees per clearinghouse | eServices à la carte or $165 bundle | DoseSpot or Ensora (per prescriber) | BetterDiagnostics add-on; no native AI suite | BAA (Feb 2026); security profiles; audit trail; encryption docs | ODTouch ($85), ODMobile, eClipboard | Self-hosted keeps running except eServices |
| Denticon | Apteryx (same corporate family; bundling not published) | Batch claims; automatic 835 posting; AutoEligibility | Reminders, two-way messaging, MyTooth (2026) | Not documented on page | AI Assist, AI Voice Perio, AI Voice Restorative Charting, DentalOS AI Agents (outbound calls) | SOC 2 Type 2, HIPAA, HITECH (FAQ); DR replication; granular audit trail | Browser | No |
| Dentrix Ascend | In-platform imaging; Detect AI; Image Verify | Claims and payments in Essentials | Included (confirmations, two-way messaging, forms, booking) | Not documented on homepage | Eligibility Pro, Image Verify, Voice Notes, Digital Forms AI, Claire; MCP layer (2026) | SOC 2; encrypted backups; role-based access | Any device | No |
| Curve | **SuperHero only** (long certified sensor list; FDA-cleared measurement tools; Pearl partner) | Unlimited eClaims/ERA/eligibility (DentalXChange, Vyne remain partners) | Curve GRO included (reminders, two-way text, online booking, Smart Fill) | Native e-Prescribe (DrFirst listed as partner) | Care+ Notes+/Charting+/Perio+ (paid add-on), Eligibility+, Ask CurveAI; Pearl, Bola partners | AWS; annual third-party intrusion testing; cites AWS's ISO 27001, not its own; Curve-corporate SOC 2 not clearly claimed | Curve Mobile | No; 5 Mbps down / 1 Mbps up minimum; satellite and wireless not recommended |
| CareStack | Integrations (28 imaging platforms per Molar Report), not a single native viewer | Centralized claims; RCM | Two-way texting, portal, reputation, kiosks, teledentistry built in | Listed under clinical | VoiceStack phones; imaging AI partners (Overjet, Pearl, Denti.ai, Aeka) | ISO 27001 badge on compare page; SOC 2 Type 2 per Molar Report | Tablet case presentation | No |
| Sensei Cloud | Sensei Cloud Imaging (2D/3D in chart) | eClaims, eVerifications modules | Patient Manager, forms modules | Rx Manager module | Not headlined | Not enumerated | Sensei Cloud Apps (2026) | No |
| tab32 | Native (PiAI radiology) | DentalXChange | Built in | DrFirst | Per-use AI fees (2026) | SOC 2 Type II (Grok-reported) | Yes | No |
| DentiMax | Bundled imaging | Add-on | No | — | No | — | No app | Server option |

## A.4 Where the platforms differ

| Dimension | What differs | Examples |
|---|---|---|
| **Deployment** | Local server vs. browser-only cloud vs. hybrid | Dentrix, Eaglesoft, SoftDent, PracticeWorks = server. Ascend, Denticon, Curve, CareStack, Cloud 9, tab32, Sensei = cloud. Open Dental, DentiMax = both. Eaglesoft requires a physical server and full remote use needs TeamViewer or LogMeIn (Patterson FAQ via Grok). |
| **Billing unit** | Per location, per user or dentist, per operatory | Open Dental and Archy per location; Eaglesoft and CareStack per user (third-party); Dentrix per operatory (third-party); Curve location-inclusive plus $100 per dentist (Grok-reported fragment). |
| **What the base includes** | Clearinghouse, texting, online scheduling, imaging, analytics | Curve SuperHero and CareStack bundle nearly everything; Curve Hero excludes imaging; Open Dental, Dentrix, and Eaglesoft sell communications, eRx, and (for Dentrix/Eaglesoft) claims as add-ons or plan tiers. |
| **Data ownership and portability** | Database format, export rights, imaging formats | Open Dental: standard MySQL, REST API, month-to-month after year one, 90-day money-back, Cloud-to-self-hosted switch without penalty. Open Dental's own Eaglesoft conversion PDF (June 17, 2026, Grok-reported) states Eaglesoft x-rays are proprietary and cannot be bridged. Dentrix stores images in a separate "image path" outside the database. tab32: a reported data-exit dispute. Curve: 90-day notice and remaining term owed (PracticeSignal). |
| **Integration openness** | Developer program, API maturity | Dentrix Developer Program (250+ partners, 700+ API endpoints at HS1 level). Open Dental open database, REST API, certified marketplace. Eaglesoft via Patterson Innovation Connection (55+). Ascend criticized for slow APIs; HS1 announced an MCP layer in 2026. Denticon "over 25 integrations"; DentalOS API newer. Curve lists a substantial partner roster but reviewers call integrations thinner than incumbents. |
| **Ledger model** | Running ledger vs. itemized/invoice-based; allocation logic | Curve invoice-based; Oryx itemized; CareStack auto-generates "transfer adjustment" lines; Open Dental's allocated/unallocated/hidden payment logic draws the most consistent complaint. |
| **Payment processing** | Native processor only vs. choice | Eaglesoft → Global Payments (reported 0.80–0.90% above interchange; CarePay+ fee waived 12 months for Service Club). Curve → Curve Pay (Stripe; U.S. only; Affirm/Klarna BNPL; flat rate unpublished) and Global Payments Integrated. Open Dental → PayConnect, PaySimple, Global Payments; CareCredit. |
| **Specialty support** | Ortho, pediatric, OMS modules | Cloud 9 ortho-only; Ascend added ortho and Voice Perio (June 2026); Sensei markets OMS/perio/pedo/ortho but OMS reviews (via competitor DSN) cite general-dental DNA and weak OR scheduling; Denticon scored 4–5/10 by a pediatric dentist coming from DOX. |
| **AI** | Native vs. partner; priced-in vs. per-use | HS1 has the deepest native stack; Curve sells Care+ as a monthly add-on; tab32 moved to per-use AI fees, which became a switch-away reason; Open Dental has no native AI suite. |
| **Contract and support model** | Month-to-month vs. annual; phone vs. ticket; support hours | Open Dental and DentiMax month-to-month. Eaglesoft Service Club plans require 24-month enrollment; non-members pay $45 per 15 minutes of support (Patterson flyer, verified). Denticon ticket-only, no 800 number (anecdotal). Curve: live experts Mon–Fri 7:30am–8pm ET plus 24/7/365 emergency line; markets one-minute answer and eight-minute resolution averages (marketing, not an SLA). SoftDent phone 7am–10pm ET. No major vendor publishes a contractual response-time SLA. |
| **Minimum infrastructure (cloud)** | Bandwidth floors | Curve: 5 Mbps down / 1 Mbps up for 1–10 users; dial-up unacceptable; satellite and wireless not recommended. |

## A.5 Costs

### A.5.1 Published rate cards (verified)

**Open Dental** (opendental.com/site/fees.html, read September 2, 2026): $199/month/location for the first 12 months (raised from $179 on February 2, 2026; offices that started at $179 keep it for the initial year), then the reduced rate published at month 13, currently $149. Up to 3 providers; $20/month per additional provider (hygienists excluded). Volume: 4–9 offices $169 → $149; 10+ call management; prepay 5% / 10% / 15%. eServices bundle $165; eClipboard $45 (+$20 OCR); eConfirmations $25 ($40 landline); Integrated Texting $20 access plus per-message ($0.04 per outbound U.S. text per Grok); Secure Email $30; Web Sched Recall $75; Web Sched New/Existing $75; Web Sched ASAP $20 (free with Recall); ODTouch $85 (4 devices); Mass Email $8. eRx: DoseSpot $57 with EPCS ($49 without) per prescriber regardless of locations; Ensora Basic $29 / Comprehensive $45 per prescriber per database, plus $45 identity proofing and $155/year EPCS. Online training $80/hour; post-conversion setup $160; custom queries $110/hour ($220 expedited per Grok); sheet design $55/hour; replication and after-hours support $100/hour; off-contract incident $150 first half-hour. Support (phone, chat, email; two issues per call) and updates are included with the monthly fee. Data conversion typical $1,450 per database plus $400 per additional clinic; documents ~$850; x-rays ~$900; insurance benefits do not convert. Open Dental Cloud $430/month/location (Medix). 90-day money-back on support and eServices. Fee increases: 2008, 2015, 2018, 2022, 2026. License changed from GPL to proprietary in version 24.4; database and API remain accessible (Medix and Elementera, both citing Open Dental).

**Unresolved discrepancy:** my September 2 fetch shows on-site training at $3,650 first day / $1,200 additional, AI Image Analysis at $199, and ODMobile at $35. Medix (Sept 1) and Grok (Sept 2) both report $4,325 / $1,325, $149, and $30. One of us read a cached variant. Confirm on the live page before quoting any of these three lines.

**Curve Dental** (curvedental.com/pricing, read September 2, 2026): two tiers, Hero and SuperHero, identical except native Curve Imaging is SuperHero-only; no dollar figures. Additional public fragments (Grok-reported): "we do NOT charge per site… fee includes all your locations… additional fee of $100 per dentist"; startup pricing on implementation and license; Curve Care+ is a monthly add-on; Curve Pay "competitive flat rate" unpublished. Third-party ranges: $299–$500/month per location (PracticeSignal, Mar 2026); ~$350–$500 per location for SuperHero (review.dental, Jan 2025, flagged stale); "$249/user/month" (PracticeSignal negotiation guide, internally inconsistent). Do not use ITQlick's per-user tiers.

**Eaglesoft** (Grok-reported from Patterson's page, which blocks fetching): no dollar prices. Service Club plans Base, Starter (10% off), Foundations (25%), Professional (30%), Growth (50% off the Service Club rate); license included with Service Club; 24-month enrollment; promotion of 50% off an advanced data conversion (a $1,000 value) for new offices through October 31, 2026, imaging conversion excluded. Patterson's support flyer (verified) confirms non-members pay $45 per 15-minute increment and pay for missed updates.

**tab32:** Alpine tier $125/month with a 14-day trial (Grok-reported from tab32.com); Summit custom.

**Other published or semi-published figures** (Medix, August 2026): Practice-Web $179 → $129 (homepage separately shows $149 → $99), conversion $1,195; Oryx Pro/Automate/AI $650 / $899 / $1,399 per location, two providers included then $100 ($200 on AI), conversion fees in a FAQ; CareStack "starting at $829" (Essentials) and "$1,299" (Intelligence), unit not stated; Archy $899 per location, unlimited providers; Denticon "starts at $795" in a product FAQ; DentiMax $100–$200 dropping to ~$129 after year one; Dentrix, Dentrix Ascend, Eaglesoft, Curve — not published.

### A.5.2 Third-party estimates for quote-only platforms

| Platform | PracticeSignal (Mar 2026) | RevUp Dental (May–Aug 2026) | Other |
|---|---|---|---|
| Dentrix | $400–$1,200/mo, per location, annual auto-renew | $400–$1,200/mo by operatories, support tier, modules; typical 3-op practice $500–$700; server $2,000–$5,000 every 3–5 yrs | Pabau $500–$1,200 (unverified) |
| Eaglesoft | $400–$600/mo + annual support | ~$200/mo solo to ~$1,500/mo for ten users | Siotek $400–$900 licensing |
| Dentrix Ascend | — | ~$500/mo, annual | Three packages (Essentials, Pro, Accelerate), no dollars |
| Denticon | $400–$700/mo | $400–$700/mo per location | $795 start (FAQ) |
| Curve | $299–$500/mo per location | $299–$500/mo per location | review.dental $350–$500 (stale) |
| CareStack | $698/user/mo | $698/user/mo | $829 / $1,299 "starting at" (own page) |
| tab32 | $300–$500/mo | $100 base; $300–$500 full | Alpine $125 (published) |
| Carestream / Sensei | $300–$500/mo, often bundled with imaging hardware | — | UK G-Cloud £135–£185 per licence |

### A.5.3 Cost lines outside the subscription

1. Data conversion: $800–$2,400 (PracticeSignal) or $1,450 plus per-clinic (Open Dental published). Dental Practice Insider (June 2026, operator blog) claims $5,000–$50,000 migration, 35% month-one production loss, and ~$19,200 training for a five-doctor practice — an order of magnitude above other sources; treat as an outlier.
2. Image and x-ray conversion: separate; Open Dental publishes ~$850 and ~$900; Curve emphasizes that its conversions include x-rays; Eaglesoft's promotion excludes imaging.
3. Insurance-plan re-entry and in-flight claims: uninvoiced staff labor; Open Dental's conversion PDFs warn that historical reports must be run in the old system and outstanding secondary claims and preauths need manual cleanup; PracticeSignal reports EDI re-enrollment of up to 30 business days.
4. Server infrastructure (server platforms): hardware, Windows Server 2025 Standard ($1,176 list) plus CALs, UPS, 5–7-year refresh, managed IT $100–$750+/month.
5. Per-provider growth: $0 (Archy) to $200/month (Oryx AI).
6. Add-on modules: an Open Dental base of $149 becomes ~$389–$446 with the eServices bundle, online scheduling, and one eRx prescriber.
7. Training beyond the included allotment.
8. Support-plan renewal increases: 8–12% annually reported for Dentrix and Eaglesoft (PracticeSignal); Denticon reported as a fixed annual escalator.
9. Payment-processing markups (Eaglesoft/Global Payments ~$400–$500/month on $50,000 card volume).
10. Per-use AI fees (tab32).
11. Lost productivity during migration: ~$5,000 for two weeks (PracticeSignal); 2–4 weeks of disruption (RevUp); 4–8 weeks inquiry to go-live for Dentrix → Open Dental (opendentalsupport.com, Grok-reported).

## A.6 Complaints

### A.6.1 Cross-platform themes (merged; ranked by recurrence across sources)

1. **Insurance and claims workflow is the daily test.** Both ADA HPI (55.3%) and Levin (56%) put insurance first among practice challenges, and review language clusters on eClaims, fee schedules, dual insurance, ERA posting, and checkout clicks. Zentist's 2026 RCM report (vendor survey) adds that 71% of respondents call real-time eligibility verification their primary daily challenge and 78% report rising denials.
2. **Opaque pricing and renewal creep.** Seven of the eleven publish nothing; support-plan increases of 8–12% (Dentrix, Eaglesoft), fixed-percentage escalators (Denticon), and two-year price rises (Curve) recur.
3. **Support during a patient-in-chair failure.** Dentrix update windows (Mon–Thu 5am–2pm), Denticon ticket-only support, tab32's decline after its AI pivot, DentiMax hold times, CareStack's slow portal ("call your account rep" — KLAS), CareStack bug reports open for months. No vendor publishes a contractual response-time SLA.
4. **Cloud reliability.** Curve's 2025 outages of six-plus hours and claims-sending failures; Denticon downtime; Open Dental Cloud freezing; Curve's own AWS-outage banner. No public uptime reports found for Curve, Ascend, Denticon, or CareStack. No cloud product documents an offline mode.
5. **Ledger and accounting readability.** Open Dental allocation logic; CareStack transfer-adjustment lines; Curve partial-payment posting and invoice-vs-ledger; Oryx AR including estimated write-offs. No harvested review praises any product for AR clarity after dual coverage and partial payments.
6. **Click-heavy or dated interfaces.** Dentrix, Ascend, and Denticon "too many clicks"; Eaglesoft unchanged since 2015 with HD imaging limits; DentiMax "format looks out of date"; Open Dental "old and boring style."
7. **Reporting.** 77% of Ascend reviewers who mentioned reporting called it confusing or inconsistent (Capterra analysis via RevUp); Curve reports "often take tech support"; tab32 "unreconciled, mismatched reports"; Open Dental few canned reports and custom SQL; Eaglesoft custom reports ~$5,000.
8. **Imaging lock-in and chairside reliability.** Eaglesoft proprietary x-rays cannot be bridged; Dentrix images outside the database; Curve "X-rays never work" and reviewers bridging to Apteryx despite Curve's FDA-cleared measurement tools; CareStack imaging as add-on with pediatric image-quality complaints; image conversion billed separately.
9. **Integration limits and data exit.** Ascend slow APIs; Denticon third-party links break; Eaglesoft Patterson-only ecosystem; tab32 data withheld pending contract payout; Curve remaining-term obligation on 90-day notice.
10. **Perio charting at hygiene speed.** Alta Voice (vendor survey, n undisclosed): 60% skip full-mouth perio when behind; 11% chart it every visit; dentists 72% vs hygienists 29% "very confident" visits meet best practice. Voice-perio add-ons exist because native perio modules are slow.
11. **Staff familiarity as switching friction.** Dentrix and Eaglesoft win hiring; Open Dental, DentiMax, and cloud products need onboarding.
12. **Update pain and AI fees.** Dentrix "constant updates"; tab32 updates ship bugs and per-use AI fees became a switch-away reason.
13. **Specialty gaps in GP-shaped products.** OMS on Sensei (via competitor DSN: weak OR scheduling, cross-coding, one report of disappearing notes, agreed price "nearly doubled" with add-ons); pediatric on Denticon and CareStack; Canadian localization on Open Dental.
14. **Vendor security and continuity.** Henry Schein's 2023 BlackCat ransomware incident (systems offline, possible exposure of customer bank and card data, $0.55–$0.75 per share business-interruption estimate); FTC's 2016 $250,000 Dentrix G5 encryption settlement; ownership churn at Patterson and Carestream; Dentrix Enterprise approaching end-of-life (Eastern Dental release, Aug 2025).

### A.6.2 Per-platform summary

| Platform | Praised (anecdotal) | Complained about (anecdotal) | Ratings (RevUp Aug 2026 unless noted) |
|---|---|---|---|
| Dentrix | Insurance/eClaims depth; ledger tied to checkout; hiring pool; 400+ integrations | Support windows; TCO and add-on stack; disruptive updates; clicks; training at scale; images outside SQL | Capterra 3.9 (376) / 4.3 (376 on Capterra UK listing); G2 4.1 (131); Townie 25% |
| Eaglesoft | Easiest legacy to learn; graphical UI; Patterson/Schick imaging; staff familiarity | UI unchanged since 2015; "development stopped 15 years ago" (CIO); HD imaging limits; non-Patterson devices; thin reporting; per-user price; Global Payments; proprietary x-rays | Capterra 4.0 (157); G2 4.2 (109); Townie 15% |
| Open Dental | Price and published fees; customization, SQL, API; support callbacks; conversions from 200+ systems; perio speed (hygienist quotes); "accommodates any office flow" | Ledger allocation; eServices extra; hiring pool; dated UI; few canned reports; frozen screens (one 2025 review); Canadian version; escalations "not cooperative" (one Canadian 2026 review) | Software Advice 4.6 (88, primary); Townie 20% |
| Dentrix Ascend | No server; remote access (100% positive among mentions); intuitive onboarding; 2026 DSO packages | Reporting (77% negative among mentions); fee-schedule workarounds; slow APIs; clicks; "not ready for the hustle" of a busy GP; DSO-skewed pricing | Capterra 4.1 (234); Townie 5% |
| Denticon | True cloud since 2003; multi-location; after-hours access; "least beta" cloud; well-integrated billing/clinical | Fixed-percentage increases; no 800 number; third-party linking failures; extra clicks; pediatric depth vs DOX; downtime; poor x-ray integration (one long-tenured user) | Capterra 4.3 (118); G2 4.7 (74); Townie 1% |
| Curve | Ease of use; "no more tech contracts"; GRO bundled; support that implements suggestions; single database for groups; conversions including x-rays | 2025 outages (6+ hours); chairside x-ray reliability; partial-payment posting; reporting; lost processor features; price increases; recent Reddit sentiment skews negative; remaining-term exit | Capterra 4.3 (351) or 4.4 (285) depending on regional site; G2 4.6 (165); Townie 4% |
| CareStack | Modern "tech-company" UI; all-in pricing; claims tracker; instant chat; onboarding; VoiceStack AI phones ("game changer" — KLAS CEO) | Ledger transfer adjustments ("accounting team HATES it"); dual-insurance glitches; imaging add-on and quality; overwhelming reports; heavy owner setup; slipped features; portal ticket delays; one 2026 dentist: "not designed with actual dentists… in mind" | Capterra 4.8 (196); G2 4.7 (175); KLAS 93.0* (n=8); not on Townie ballot |
| Sensei Cloud / SoftDent / PracticeWorks | Anywhere access; Sensei Imaging 2D/3D in chart; Carestream hardware path | Thin public docs; no install count; OMS gaps and implementation pain (competitor-compiled); add-on price surprise; bimodal reviews | ~3.7 (31) per Molar Report; Townie SoftDent 2%, PracticeWorks 1% |
| tab32 | "Fired IT"; pace of development; startup all-in-one; CEO accessibility | Support decline after AI pivot; per-use AI fees; x-ray manipulation limits; unreconciled reports; update bugs; data-exit dispute | Capterra 4.3 (41); Townie 0% |
| DentiMax | Value; "real accounting" ledger; dental-experienced support; optional upgrades | Hold times; Windows-only; no mobile app; dated UI; staff unfamiliarity; thinner features | Capterra 4.5 (94); Townie 1% |
| Oryx (bubble) | Low latency; native FDA-cleared imaging; built-in clearinghouse; startup package | Billing learning curve; AR/write-off presentation; paid training and conversion | G2 4.8 (26); Townie 1% |

## A.7 Structural trends to track

- **Subscription conversion.** Patterson reported 27% subscription growth and an 11% perpetual-license decline in fiscal 2024; third parties say new Eaglesoft customers have been subscription-only since 2024 with the installed base migrating through 2026; Patterson has published no timeline. Planet DDS sunset Apteryx's on-premise version.
- **Product sunsets and end-of-life.** Easy Dental support ended December 31, 2023; PracticeWorks is closed to new customers; Eastern Dental cited Dentrix Enterprise as approaching end-of-life when it moved to Denticon (Aug 2025).
- **DSO consolidation onto one PMS.** Five Point Dental Specialists consolidating 17 systems to Denticon + Cloud 9; Dykema's Brian Colao: "three or four different PMS systems is too inefficient"; DSO-affiliated dentists plan software investment at 29.0% vs 16.3% for non-DSO (ADA HPI Q4 2025).
- **Cloud claims exceed measurement.** Curve's CEO says 85% of ~160,000 North American practices remain on client-server; marketing pages elsewhere claim >80% cloud. Neither is a census; the Townie vote (60% for the on-premise big three among named products) leans the CEO's way for independent GPs.
- **AI adoption is real but bolted on.** Levin: 43% of practices report using AI (Grok-reported). Native AI ships as paid modules (Dentrix Ambient, Curve Care+, Ascend packages, tab32 per-use); independent evidence (ADEPT study via Elementera) shows false-positive tradeoffs; ADA told HHS in Feb 2026 that adoption is uneven in small and mid-sized practices.
- **Capital and consolidation.** Curve's $200M R&D commitment and ~$100M ARR; HS1's agentic/MCP push; Curve's CEO predicts >40% of PMS vendors gone in 36–48 months (advocacy).

---

# Part B — Risk-Management Platforms for Small Businesses (v3)

**What changed from v1/v2.** Grok's package contained nothing on risk management, so this part is my own second pass. It adds two categories I missed in v1 — practice-facing HIPAA/OSHA compliance platforms for small healthcare and dental practices, and operational/insurable-risk platforms for small business — and it closes the held candidate about financial internal-control tools. Labels follow Part A: Verified (primary), Vendor-reported, Third-party estimate, Anecdotal, plus **Competitor-reported** for figures published by a rival vendor.

## B.1 Category map

The phrase "risk-management platform that recommends internal controls and engages the user to tailor them" maps onto five distinct markets. They rarely overlap, and a product that is excellent in one is usually a poor fit in another.

| Category | What "controls" means | Typical buyer | Representative products | Does it question the user and generate tailored controls? |
|---|---|---|---|---|
| **1. Compliance automation (cyber/IT GRC)** | Security and privacy controls mapped to SOC 2, ISO 27001, HIPAA, PCI, NIST, CMMC; evidence pulled from cloud, identity, HR, and code systems | SaaS startups and tech-enabled SMBs facing customer security reviews | Vanta, Drata, Secureframe, Thoropass, Sprinto, Scrut, ComplyJet, Hyperproof, Scytale, Strike Graph, Anecdotes, Oneleet | Yes — scoping questionnaire → control set and policy templates → automated tests; AI agents draft policies and answer questionnaires |
| **2. ERM / integrated GRC suites** | Risk registers, assessments, control libraries, policy management, audit workflows, board reporting | Mid-market and enterprise risk, audit, and compliance teams | LogicManager, LogicGate Risk Cloud, Riskonnect, Resolver, AuditBoard (called Optro in some 2026 sources), Diligent (incl. AI Risk Essentials), MetricStream, Archer, IBM OpenPages, Workiva, Onspring, ZenGRC, SimpleRisk | Partly — control libraries and templates; tailoring is configuration work, often with consultants |
| **3. Practice-facing regulatory compliance (HIPAA / OSHA)** — *new in v3* | Privacy and Security Rule safeguards, OSHA programs, BAAs, training, breach response | Independent healthcare practices (dental, medical, therapy, chiropractic) with 1–25 staff; DSOs | Abyde, Compliancy Group, AccountableHQ, Total HIPAA, Medcurity, Patient Protect, HIPAA One; dental-specific services: Smart Training, Dental Compliance Specialists, SafeLink, Modern Practice Solutions, Gamma Compliance | **Yes — this is the closest match to the shape you described.** Guided risk-analysis questionnaires → practice-specific policies and remediation tasks → training and audit-defense support |
| **4. Operational / insurable risk for small business** — *new in v3* | Safety programs, hazard controls, incident and claims management, cyber hygiene tied to insurance pricing | Owner-operated businesses with employees and workers' comp or cyber policies | SmarterRisk; inspection apps (SafetyCulture/iAuditor, Safesite, KPA); carrier risk-control visits; insurer-linked cyber tools (Coalition Control) | **Yes for SmarterRisk** — 15-minute AI-guided assessment → risk score, prioritized improvement plan, policy builder, insurance-ready report. Inspection apps are checklists, not advisors |
| **5. Financial internal controls and fraud prevention** | Segregation of duties, approval thresholds, audit trails, bank-to-ledger reconciliation, anomaly detection | Owner-operated businesses, CPAs, forensic accountants; dental practices specifically | Controls inside accounting systems (QuickBooks, Sage Intacct, Xero); AI audit analytics (MindBridge); AP/spend controls; dental-specific Zeldent, Prosperident, Dental FraudBusters; frameworks (COSO ICIF, COSO/ACFE Fraud Risk Management Guide) | **No interactive SMB product found** after two targeted search rounds; tailoring is done by CPAs and frameworks, and monitoring by reconciliation tools |

## B.2 Compliance automation platforms (cyber/IT GRC)

**How they recommend and tailor controls.** The user answers a scoping questionnaire (frameworks, systems, headcount, cloud providers). The platform proposes a control set and policy templates, connects to AWS/GCP/Azure, Okta/Google Workspace, Jamf/Intune, Rippling/Gusto/BambooHR, GitHub, and runs automated tests (hourly, not truly continuous) that flag failing controls. Newer releases add AI agents that draft policies, answer security questionnaires, and map one control to many frameworks.

**What they do not do.** They do not issue the audit (a CPA firm does, for a separate $15,000–$50,000), they do little for financial or operational controls, and coverage drops to roughly 50–60% for on-premise or custom stacks (third-party estimate). Patient Protect's market map states the mismatch plainly: these platforms were built for software companies pursuing SOC 2, and a 1–25-person clinical practice with phishing, misdirected fax, and unsigned BAAs as its threat model is over-served by them.

**Pricing (no vendor publishes a rate; figures are procurement datasets and partner estimates):**

| Platform | Entry list (third-party) | Observed transaction data | Notes |
|---|---|---|---|
| Vanta | Core/Essentials ~$10,000/yr | Vendr median annual spend $19,800 (315 purchases); Vanta Professional median $65,600 at a 500-employee baseline (range $6,900–$109,600, N=106); Spendflo $30,000–$80,000 | ~$5,000 per additional framework; SCIM gated behind an add-on; $300M+ ARR, 16,000+ organizations (Apr 2026) |
| Drata | Foundation $7,500–$15,000/yr | Vendr Advanced median $20,300 (range $16,600–$39,700, N=94); average contract ~$13,500 | ~$1,500 per additional framework; 4.7/5 on 1,331 G2 reviews |
| Secureframe | Fundamentals $7,500–$20,000/yr | Similar purchases $8,000–$34,000 | Most hands-on managed services |
| Thoropass | $8,700–$80,000/yr | No Vendr data | Only vendor that bundles the auditor |
| Sprinto | Often under $7,500 for <50 employees | Vendr Advanced median $19,600 (N=6) | INR billing option |
| Scrut, ComplyJet | Often under $7,500 for one framework | — | Budget tier |
| Anecdotes | — | Vendr median $33,000 (N=17) | Enterprise-leaning |

Negotiation levers reported: multi-year terms (10–20% off), quarter-end timing, multi-framework bundling, certified-partner pricing (15–25% off list).

**Complaints (anecdotal, G2 and Reddit via aggregators):** renewal shock (Vanta +40–100% after first-year discounts; Drata +20–40% on headcount tiers; a shared example of $7,500 → $20,000 to add two frameworks; one Reddit user: "maybe the worst company we ever partnered with"); quote-only pricing; "checkbox compliance" with tests "often not comprehensive"; automation gaps on custom stacks; rigid templates and billing clarity (Vanta); longer setup (Drata); shelfware if one person owns compliance.

## B.3 ERM / integrated GRC suites

| Platform | Positioning | Pricing | Fit for small business |
|---|---|---|---|
| SimpleRisk | Open-source-heritage GRC: risk register, mitigation planning, management review, control frameworks, incident response | **Verified:** Core free; Hosted $4,995 / $9,995 / $19,995 per year; On-Premise $9,995 / $14,995 / $19,995; 10% logo discount, 10% two-year prepay, 20% three-year prepay; G2 "Starter Package" $5,000 | Best fit for an SMB that wants a real risk register; users cite limited customization and integrations |
| LogicManager | Mid-market ERM; fixed-fee unlimited users; advisory support | Starts ~$10,000/yr (SelectHub); $25,000–$100,000 (trio.dev); vendor says ERM runs $20,000–$40,000 | Upper-SMB; criticized as rigid, IT-governance-centric, limited API |
| LogicGate Risk Cloud | No-code workflow GRC; AI questionnaire autofill | Custom | Mid-market |
| Diligent (ERM; AI Risk Essentials) | Board-reporting-centric; Essentials claims one-week setup with prebuilt templates | Custom | Essentials targets smaller orgs; learning curve and vendor-dependent report changes |
| Riskonnect | Broadest ERM incl. insurable risk and claims | ~$283,000/yr start (SelectHub) | Enterprise only |
| Resolver, Archer, MetricStream, NAVEX, Origami Risk | Enterprise RMIS/GRC | $50,000–$200,000+ | Enterprise only (SmarterRisk's characterization agrees) |
| AuditBoard / Optro | Audit-led, SOX and controls testing | Custom | Enterprise; Optro markets ML anomaly alerts |
| IBM OpenPages | AI-augmented ERM | SaaS Essentials indicative ~$3,300 (published) | Unusual published entry price on enterprise architecture |
| Workiva | SOX and reporting-grade risk data | Custom | Public-company oriented |
| Risk Register by ProjectBalm and similar | Project-level risk tools | $29–$49/user/month | Lightweight |

## B.4 Practice-facing regulatory compliance platforms (HIPAA / OSHA) — new

This is the risk-management software a dental practice actually buys, and it works the way you described: the practice answers a guided questionnaire, the platform generates practice-specific policies and a remediation list, tracks staff training, stores BAAs, and provides audit-defense support. The California Dental Association endorses Abyde as a member benefit and describes it as guiding practices through mandatory requirements — risk management programs, training, customized policy documentation — with customized policy generation based on the practice's specific circumstances (CDA, Jan 2026). Venn's 2026 roundup describes the same mechanics: guided security risk assessments with tailored questions, one-click policy generation kept current with federal and state rules, training with certificate management, and expert support during complaints, breaches, or audits.

**Market structure (Patient Protect market map, Sept 2026 — competitor-authored, but the taxonomy is sound):** three product kinds — healthcare compliance platforms (Abyde, AccountableHQ, Patient Protect, Medcurity), service-led providers with human coaching (Compliancy Group, Total HIPAA), and multi-framework GRC (Vanta, Drata, Sprinto) that over-serves a clinical practice. Two distinctions matter: *recorded vs. enforced* (does the workflow refuse to move PHI until a BAA is signed, or merely log that it should be?) and *documentation-first vs. active prevention* (breach simulation, audit logging, secure messaging). A typical dental office has 8–15 business associates, and a missing BAA is a violation on its own before any breach.

| Platform | Model | Published or reported price | Source and label | Notes |
|---|---|---|---|---|
| Patient Protect | Product-led; HIPAA only; compliance state recalculates as risks open/close; BAA-gated messaging; PHI audit logging; PIPAA AI assistant on vendor-controlled inference | **$39/mo Basic, $99/mo Pro; no contracts; 14-day trial** | Vendor page, verified Sept 2026 | Newest entrant; discloses that its team credentials (CHPSE, CHSE, CHPE) are individual, not platform, certifications |
| Abyde | Product-led; HIPAA + OSHA; automated risk analysis; one-click policy generation; audit protection | Starting **$115/month** (Capterra listing, 1 review); computed quote in-browser per Patient Protect | Third-party | Founded 2016, Clearwater FL; CDA-endorsed; dental and medical focus |
| AccountableHQ | Self-serve platform; per-employee pricing; vendor auto-detection; multi-location | "Starts at $99/mo" (own comparison page); $149–$249/mo or $1,788–$2,988+/yr (Medcurity) | Vendor page; competitor-reported | Claims 10,000+ companies, 30 days average time to compliance (vendor) |
| Compliancy Group | Coach-led; HIPAA + OSHA + SOC 2; "Seal of Compliance" | "Typically $3,000+/yr, custom quotes" (AccountableHQ and Medcurity comparison pages) | Competitor-reported | Reviewer at a small dental DSO praises support and the Q&A risk-assessment format (vendor site testimonial) |
| Medcurity | Self-service SRA plus advisor and onsite assessment tiers; HIPAA only | **$499–$1,200/yr** (own page) | Vendor page | Positions against AccountableHQ on cost for a 10-person dental practice |
| Total HIPAA | Templates, policies, training with service tiers | Lists rates (per Patient Protect); not captured | — | Fit only when internal HIPAA expertise exists |
| HIPAA One | MSP-partnered | $4,000+/yr (Medcurity) | Competitor-reported | — |
| Smart Training | Dental OSHA/HIPAA training LMS; virtual compliance inspection simulating an OSHA visit; written programs on Premium | **Basic $79/user/yr**; Premium priced per location | Vendor cart pages | Claims 15,000+ dental professionals |
| Dental Compliance Specialists; SafeLink; Modern Practice Solutions; Gamma Compliance | Consulting audits (OSHA, infection control, radiation, DEA, sedation, Medicaid, HIPAA), site audits, tailored policies, manuals | Package or quote | Vendor pages | Service, not software |

**Complaints and caveats.** Review volume is thin (Abyde has one Capterra review); most published comparisons are written by competitors (Patient Protect, Medcurity, AccountableHQ), so treat cost claims about rivals as competitor-reported. Recurring criticisms: consultant-dependent onboarding and annual contracts (aimed at Compliancy Group), enterprise feature breadth and per-employee pricing (aimed at AccountableHQ), template libraries that are not a live program (aimed at Total HIPAA), and — from Patient Protect — whether an AI compliance assistant routes patient context through third-party LLM APIs. IBM's 2026 report puts the average healthcare breach at $6.64 million (cited by Patient Protect).

## B.5 Operational and insurable-risk platforms for small business — new

**SmarterRisk** is the closest thing found to a general-purpose "risk advisor" for owner-operated businesses. Its vendor pages describe a 15-minute assessment guided by an AI assistant (RISK-B) that returns a risk score, a prioritized improvement plan with why/how/resources for each item, and a report formatted for an insurance agent or carrier; a policy builder with 20+ customizable safety programs aligned to OSHA, NFPA, ANSI, and ISO; 50+ training courses; 150+ forms; photo-verified recommendation tracking that updates the score. Price: **$500 per year** (Intelligent Plan; one-year term if paying monthly). The pitch is insurance economics — workers' compensation premiums of $20,000–$100,000+ per year, experience-modification effects lasting three years — rather than fraud or financial control. All claims are vendor-reported; no independent reviews were found.

SmarterRisk's own market framing (which matches what I found): enterprise RMIS/GRC (Origami Risk, LogicManager, NAVEX, Riskonnect) costs $50,000–$200,000+ with 6–12-month implementations; inspection apps (iAuditor/SafetyCulture, Safesite, KPA) document hazards and complete forms but do not assess organizational risk or connect to insurance outcomes; carrier risk-control visits happen roughly every five years and leave a list with no implementation support.

**Insurer-linked cyber risk.** Coalition offers a free external risk assessment and "Coalition Control," an AI-powered risk-management platform tied to its active cyber insurance (now in a global partnership with Allianz). Zywave serves brokers (quoting and benchmarking), not the business owner.

## B.6 Financial internal controls and fraud prevention

**Why this category matters for dental practices.** ADA Council on Dental Practice surveys found 35% of responding dentists had been embezzled (2008 survey) and 48% (survey released Feb 2020); only 17% of thefts were discovered through the practice's planned controls and 83% by chance (Prosperident analysis); average loss ~$105,000–$109,000; David Harris estimates 60–70% of dentists will be embezzled and puts profession-wide losses above $1 billion a year. ACFE data cited by Zeldent: ~40% of frauds surface through tips, ~15% through internal audit, ~12% through management review; median scheme duration 18 months; average embezzler tenure eight years (Hiscox). Trustpair's 2026 fraud report (via a secondary blog) says 71% of U.S. companies saw more AI-driven fraud attempts in the past year.

**Where "recommend and tailor controls" lives today:**

1. **Frameworks (free or low cost).** COSO's 2013 Internal Control–Integrated Framework (17 principles; Principle 8 on fraud risk). The COSO/ACFE Fraud Risk Management Guide, 2nd edition (2023), states no one-size-fits-all program exists and organizations of any size can build a custom-fitted one; the ACFE Fraud Risk Tools site adds a self-assessment, a hyperlinked fraud-scheme library, data-analytics tests, and templates. COSO published audit-ready generative-AI governance guidance in February 2026. The CPA Journal (Aug 2026) maps the Guide's five principles to COSO's five components and stresses management-override controls.
2. **Controls inside accounting systems.** QuickBooks: audit trail that cannot be turned off (defeated by shared "Administrator" logins); screen-level and bank-account-level user restrictions in Enterprise; exception reports for duplicate payments, voided transactions, unusual vendors; Positive Pay is not native (Intuit community). Intuit's product updates state that Finance AI now continuously monitors KPIs and flags anomalies with a suggested next step, and Intuit Intelligence connects accounting, payments, payroll, bill pay, and tax data (verified, Intuit page). Sage Intacct: named-user roles, prepare-vs-approve separation, full audit trail, AI anomaly detection. Xero guidance: split recording, authorization, and reconciliation; restrict bank-detail changes; dual sign-off at $2,500–$5,000.
3. **AI audit analytics and AP controls.** MindBridge scores full transaction populations against a COSO-aligned checklist (sold to CPA firms); AP and card platforms enforce approvals and flag anomalies; a 2026 secondary source puts software-only anomaly-detection and reconciliation tools at $20–$70/month for very small businesses and AI-enhanced bookkeeping at $200–$550/month.
4. **CPA-led fraud risk assessments and outsourced accounting.** Every small-business internal-controls guide retrieved (Friedman+Huey, MZBPO, 8020 Consulting, VAAS, MSM Taxes, Paychex, Anders, EisnerAmper, Consero, GrowthForce) delivers the same checklist — segregation of duties, dual approval thresholds, owner review of bank notifications and reconciliations, mandatory vacations, vendor-change verification — and then offers the tailoring as a professional service.
5. **Dental-specific.** Zeldent (bank-to-PMS reconciliation with anomaly alerts; integrates with all major PMS; pricing unpublished; thesis: the bank is the only independent ground truth); Prosperident (investigation and prevention services, risk-assessment questionnaire, PMS-report monitoring checklist; MDA-endorsed); Dental FraudBusters.

## B.7 The gap, now confirmed

After two targeted search rounds, **no mainstream product for small businesses interactively assesses the owner's operation and then recommends and tailors financial and operational internal controls.** The interactive-assessment pattern exists and works in three adjacent markets — cyber controls (Vanta, Drata), HIPAA/OSHA controls (Abyde, Patient Protect, Medcurity), and workplace-safety controls (SmarterRisk) — each of which questions the user, scores the gap, generates tailored policies, and tracks remediation. Financial controls have the frameworks (COSO/ACFE), the monitoring tools (Zeldent, QuickBooks anomaly flags), and the professional-service channel (CPAs), but not the product. The dental evidence — 48% victimization, 17% detection by design, ledgers that trained billers cannot read — says the controls practices believe they have are not working.

**Price points in the adjacent markets set the reference band for such a product:** $39–$115/month (Patient Protect, Abyde), $499–$1,200/year (Medcurity, SmarterRisk), $3,000+/year (coach-led Compliancy Group), $7,500–$10,000+/year (Vanta, Drata entry tiers).

---

# Part C — Cross-cutting observations

1. **Both markets share the same complaint profile:** quote-only pricing, renewal creep, support degradation after growth or a strategic pivot (tab32 and Curve in dental; Vanta and Drata in GRC), lock-in through data formats or integrations, and add-on or per-use fees that erode the headline price. One buyer checklist works for both: billing unit, year-two rate, exit and export terms, what the base includes, whether an enterprise agreement replaces the published rate, and incident history rather than an uptime slide.
2. **PMS choice is an internal-control decision.** Role-based permissions, audit-trail quality, refund and adjustment controls, and reconciliation reporting differ by platform, and the complaint data shows ledgers that confuse trained billing staff and CPAs (CareStack, Open Dental, Curve, Oryx). A ledger that staff cannot read is a ledger an owner cannot audit — and the ADA data says only 17% of dental embezzlement is caught by the practice's designed controls. Part B.7 records that no SMB product yet closes that gap interactively, while adjacent markets (HIPAA, safety, cyber) already do.
3. **Data in both markets is thin and commercially motivated.** Grok and I independently applied the same four tests (who collected it and how; what unit; what commercial interest; traceable to a primary document) and reached the same verdicts on FMI, technographic databases, and vendor counts. Where we disagreed, the cause was a page variant (Open Dental fee lines) or a table misread (Curve tiers), not the evidence.
4. **Contradictions kept visible:** Open Dental fee lines (three figures, two readings); PracticeSignal's Curve per-location vs per-user figures; CareStack's four footprint numbers; Eaglesoft "users" vs "practices"; Planet DDS 13,000 / 14,500 / 15,000+; ADA survey year labels (2007/2019 vs 2008/2020); Curve ownership (Battery Ventures vs Clearlake); Curve migrations (4,000+ FAQ vs 2,500+ review.dental); Curve R&D ($60M/3 years in FAQ vs $200M in the Aug 2026 release); Curve review counts (351 vs 285 across Capterra regional sites); RevUp's Open Dental support claim vs the fee page.

---

# Part D — User-research synthesis (applying the user-research framework to Grok's voice-of-dentists material)

## D.1 What the demand-side evidence actually is

| Source | Method and n | What it measures | Trust for PMS questions |
|---|---|---|---|
| ADA HPI Economic Outlook, Q1 2025 | Panel survey; 791 responses (738 private practice) | Software investment: 18.1% of owners invested in new software in Q1; 16.8% solo vs 20.5% in 2–9-dentist practices; 28.0% of dentists aged 35–44 | High for investment intent; silent on brands |
| ADA HPI State of the Dental Economy, Q4 2025 (rev. Feb 3, 2026) | Panel survey; 751 respondents (Becker's) | Top-3 challenges: insurance 55.3%, staffing 54.2%, overhead 41.5%; 16.9% likely to invest in new software in 2026 vs 42.3% adding staff; DSO 29.0% vs non-DSO 16.3% on software; 23.3% actually invested in 2025 vs 20.3% who planned to | High; verified via Becker's Dental |
| Dental Economics–Levin Group Annual Practice Survey, 2025 data (May 2026) | n not published; 87% owners in independent practice; 52% solo; average age 55 | Declining reimbursements 56%, rising overhead 55%, hiring clinical staff 53%; 43% using AI (Grok-reported); 23% adding technology for productivity; 76% have an open position | Medium; verified that the article exists and reports 55% overhead |
| Dentaltown Townie Choice Awards 2025 | 358 votes; popularity vote | Dentrix 25%, Open Dental 20%, Eaglesoft 15%, Ascend 5%, Curve 4%, SoftDent 2%, ABELDent 2%, Denticon 1%, tab32 0%; "do not use" 10% | Low for install base; useful for the independent-GP electorate; Grok-reported |
| KLAS Research, CareStack First Look (Mar 2024) | 8 interviews from 7 organizations (vendor-supplied list) | Overall 93.0 (limited); 100% would buy again (n=7); portal tickets slow; doctors want imaging | Low n; directional |
| Forrester TEI of CareStack (Oct 2023) | Commissioned by Straumann; 52 multi-site decision-makers; 10-location composite | 307% ROI, payback <6 months; 44% prioritize patient experience | Vendor-commissioned; the buyer profile is real, the numbers are modeled |
| Alta Voice, State of the Hygiene Appointment (Jul 2026) | Vendor survey; n undisclosed; dentists, OMs, hygienists | 95% of dentists vs 52% of hygienists say there is enough time; 72% vs 29% "very confident"; 60% skip perio when behind; 11% chart full-mouth every visit | Low-medium; the only role-split data found |
| Zentist 2026 RCM Trends report (Feb 2026) | Vendor survey; n not in release | 71% name real-time eligibility the primary daily challenge; 78% report rising denials; 58% committing to automation | Vendor-authored; directional |
| Software Advice / Capterra / G2 / TrustRadius | Self-selected reviews; vendor-invited | Star averages over-represent newer cloud products and under-represent the silent Dentrix/Eaglesoft base | Anecdotal |
| DentalPost 2025 salary survey | 271 practice managers | Compensation and retention; software mentioned as part of the job | Context only |

**Two structural facts shape everything below.** Software is a minority capital decision (16.9% plan to invest vs 42.3% adding staff), and the people who buy the PMS (owner-dentists, average survey age 55) are not the people who live in it all day (office managers, billers, hygienists). Almost every survey is dentist-weighted.

## D.2 Affinity map — themes from the harvested voice

| Theme | Sub-themes | Strongest evidence | Who feels it most |
|---|---|---|---|
| **Getting paid** | Eligibility, fee schedules, dual insurance, ERA posting, partial payments, claim scrubbing | ADA 55.3%; Levin 56%; Zentist 71%/78%; Dentrix eClaims praise; Ascend fee-schedule workarounds; CareStack dual-insurance glitches; Curve partial payments | Office managers, billers |
| **Reading the money** | Ledger allocation, transfer adjustments, invoice vs ledger, AR write-offs, reports that match the bank | Open Dental allocation complaints; CareStack "accounting team hates it"; Oryx AR; Ascend 77% reporting negative; tab32 unreconciled reports | Billers, CPAs, owners |
| **Time in the chair** | Perio speed, notes, voice, clicks | Alta Voice 60%/11%; "too many clicks" across Dentrix, Ascend, Denticon; hygienists praising Open Dental perio | Hygienists, dentists |
| **Predictable cost** | Published rates, per-provider fees, add-on stacking, renewal increases, per-use AI | Open Dental fee page as "why we switched"; 8–12% renewals; Denticon escalator; tab32 AI fees | Owners |
| **Not being held hostage** | Imaging formats, database access, export rights, contract exit | Eaglesoft proprietary x-rays; Dentrix image path; tab32 data dispute; Curve remaining term; Open Dental month-to-month | Owners at switching time |
| **Keeping the lights on** | Server upkeep vs cloud outages, backups, ransomware, bandwidth floors | Curve 6-hour outages; Denticon downtime; "fired IT" (tab32); Henry Schein 2023 | Owners, IT |
| **Help when it breaks** | Support hours, update windows, ticket-only, escalation | Dentrix Mon–Thu 5am–2pm; Denticon no phone; CareStack portal; tab32 collapse; Curve "below sub par" | Everyone, during patient hours |
| **Staffing reality** | Hiring pool knows the software; temp coverage; onboarding time | Dentrix/Eaglesoft familiarity; Open Dental and DentiMax retraining; Levin 53% clinical hiring difficulty | Owners, office managers |
| **Growing** | Single database, multi-location scheduling, DSO consolidation, two-way integration | Five Point 17 → 2 systems; Colao; Parikh's two-way read/write; Ascend slow APIs | Multi-location owners, DSO ops |
| **Specialty fit** | Ortho, pedo, OMS workflows | Cloud 9/Dolphin; Denticon vs DOX; Sensei OMS complaints | Specialists |

## D.3 Jobs to be done, by persona

| Persona | Primary job | Hire criteria (from evidence) | Fire triggers |
|---|---|---|---|
| **Solo or small independent GP owner** (the Townie electorate) | Run the business without becoming an IT or billing expert | Hiring pool, insurance depth, predictable cost, data ownership; cloud optional | Renewal increases, support failures, server refresh, a second location |
| **Multi-location independent (2–9 dentists)** | One patient record and schedule across sites, accessible after hours | Single database, remote access, no per-site fees, conversions that include x-rays | Sync failures, per-user pricing growth, outages |
| **DSO operations leader** | Standardize and centralize RCM, reporting, and onboarding across acquisitions | Enterprise agreement, two-way APIs, centralized RCM, role-based permissions, audit trail, DSO packaging | Platform end-of-life (Dentrix Enterprise), integration breakage, per-location conversion cost |
| **Office manager / biller** | Post, reconcile, and collect without workarounds | Clear ledger, ERA auto-posting, claims tracker, dual-insurance handling, checkout with few clicks | Ledger confusion, ticket-only support, reports that do not reconcile |
| **Hygienist** | Complete full-mouth perio and notes inside the appointment | Perio speed, voice entry, odontogram simplicity | Lag, extra hands required, skipped charting |
| **Specialist (ortho, pedo, OMS)** | Specialty workflow without GP workarounds | Native specialty modules, cross-coding, OR scheduling, referral management | GP-shaped product imposed by acquisition |
| **Owner as fraud-risk manager** (cross-link to Part B) | Know that collections match deposits | Audit trail, refund and adjustment controls, bank-to-PMS reconciliation | Discovering theft by chance (83% of cases) |

## D.4 Must-haves, ranked by evidence weight (Grok's ranking, checked)

1. Insurance workflow that posts, estimates, and tracks claims without workarounds.
2. Labor-saving clinical and admin documentation (perio, notes, phones).
3. Predictable total cost (no per-provider surprises, no unquoted add-ons).
4. Imaging that lives in the chart and survives a switch.
5. A hiring pool already trained on the software.
6. Single database across locations.
7. Patient communication in or next to the PMS.
8. Support that answers during patient hours.
9. Data portability and a contract you can leave.
10. Reporting that matches the bank and the doctor's questions.

I agree with the order except that I would move #10 up: reporting that reconciles to the bank is the control point for both the "reading the money" theme and the embezzlement data in Part B.

## D.5 Impact / effort view of the unmet needs (my judgment, labeled)

| Unmet need | Practice impact | Vendor effort to fix | Who is closest |
|---|---|---|---|
| Ledger both clinicians and accountants can read | High (daily; audit-relevant) | Medium (data model and UI) | DentiMax ("real accounting"), Oryx itemized billing; nobody universally |
| Perio at hygiene speed without a second person | High (clinical quality, morale) | Medium (voice is shipping as add-ons) | HS1 Voice Perio, Curve Perio+, Bola, Alta |
| Portable imaging | High at switching time only | High (formats, vendor incentives against it) | Open Dental (DICOM export); Curve (converts x-rays) |
| Published prices and exit terms | High for trust; low for daily use | Low (a decision, not a build) | Open Dental, DentiMax, tab32 Alpine, Archy, Oryx |
| Chairside support SLA | High during failures | Medium (staffing) | None publish one |
| Reporting without SQL | High | Medium | Denticon dashboards; CareStack (overwhelming); Curve Insights (needs support) |
| Specialty-native workflows | High for specialists | High | Cloud 9, Dolphin, WinOMS/DSN |
| Two-way interoperability | High for DSOs | High | Open Dental API; HS1 MCP layer (new) |
| Cloud reliability as a utility | High | Medium (engineering + transparency) | Curve status page; no one publishes uptime history |
| Priced-in, validated chairside AI | Medium now, rising | High (validation, pricing model) | HS1 packages; Curve Care+ (paid) |
| Canada / non-U.S. parity | High for Canadian practices | Medium | ClearDent, Tracker, ABELDent |
| A PMS office managers and hygienists would choose | High | Cultural, not technical | None market to them |

## D.6 Highlight reel (short attributed quotes)

- Dentrix owner on update scheduling: "Do they only have one person installing Dentrix updates?" (Capterra via RevUp)
- Former Dentrix owner: keeping up with the software "had become its own primary feature." (Capterra via RevUp)
- CIO on Eaglesoft: "Really developing and fixing Eaglesoft stopped 15 years ago." (Capterra via RevUp)
- Hygienist on Open Dental: "I would be a cult leader for Open Dental." (Software Advice, 2023)
- r/Dentistry on Open Dental's ledger: "the allocated/unallocated/hidden payments in the ledger." (via RevUp)
- r/Dentistry on CareStack: "My accounting team HATES it with the passion of 1,000 suns." (via RevUp)
- r/Dentistry owner on Curve, 2025: "completely inaccessible for hours, sometimes six plus hours." (via RevUp)
- Dentist on Denticon's UI: "Don't be fooled by the archaic GUI." (Capterra via RevUp)
- Owner who left tab32: per-use AI "when you multiply by 40 patients a day would be prohibitive." (Capterra via RevUp)
- KLAS director on CareStack support: "calling my account representative is the best way to get things done." (KLAS, 2024)
- Pediatric dentist on Ascend: "So many workarounds suggested rather than ensuring a truly functional product." (Capterra via RevUp)
- Dykema's Brian Colao on DSOs: "Consolidation is now the standard." (Planet DDS blog, 2025)

## D.7 Honest gaps (what neither research pass could find)

- No national probability-sample survey asking "which PMS do you use."
- No public G2 Grid or Capterra directory export for the category (both blocked).
- No live Reddit, Open Dental forum, HygieneTown, or SDN thread harvest; all forum quotes arrive via aggregators.
- No sample size for the Alta Voice or Zentist surveys; no Levin n.
- No public uptime history for any cloud PMS.
- No vendor-published response-time SLA.
- The "61% of buyers cite price and integration" (Software Advice 2025) and "more than half of practices now use cloud, per ADA" (PracticeSignal) claims could not be traced to their supposed sources — do not cite them.
- No cap-table source resolving Curve's Battery Ventures vs Clearlake ownership.
- Open Dental's fee page appears to serve two variants; the training and AI lines need a manual check.

## D.8 Research plan to close the gaps

**Objectives.** (1) Establish which PMS each persona actually uses and why, with a defensible sample. (2) Measure the office-manager and hygienist experience the dentist-weighted surveys miss. (3) Test whether reconciliation and ledger readability predict fraud-control confidence (the bridge to Part B). (4) Capture switching triggers and exit costs from practices that changed platforms in the last 24 months.

**Methods, in order.**

| Phase | Method | Participants | n | Duration | Output |
|---|---|---|---|---|---|
| 1 | Interviews (60 min) | Owner-dentists (solo and multi-location), office managers/billers, hygienists, one DSO ops leader | 6–8 per persona (24–30 total) | 3–4 weeks | Themes, JTBD refinement, survey questions |
| 2 | Survey | Recruited via Dentaltown, Facebook "Dental Office Managers," state associations, DentalPost; stratify by role, practice size, DSO affiliation | 150+ (target 100+ office managers) | 2 weeks | Brand usage by persona; satisfaction by task; control-practice prevalence |
| 3 | Diary study (optional) | Office managers on 3–4 platforms | 8–12 | 2 weeks | Daily reconciliation and claims friction, time-stamped |
| 4 | Usability probes | Ledger reading and adjustment tasks on 3 platforms | 5–8 per platform | 1–2 weeks | Task success and error rates for AR clarity |

**Screening.** Practicing in the U.S.; role and tenure ≥12 months; platform and version; whether the practice switched PMS in the last 24 months; single vs multi-location; DSO affiliation; who reconciles deposits and how often.

**Interview guide (60 minutes).**

1. *Warm-up (5 min).* Role, tenure, practice size, platform and how long on it.
2. *Context (10 min).* Walk me through yesterday from first login to close. Where did the software slow you down? Who touches money and where?
3. *Deep dive (25 min).* Probes by theme: insurance (last claim that did not post cleanly; dual coverage; partial payments); ledger (explain a patient balance to me as you would to the patient; what does an adjustment mean here); reconciliation (how do you know collections matched deposits; who checks; how often; what would you miss); support (last failure with a patient in the chair; how long to resolution); cost (what you pay, what surprised you at renewal, add-ons you bought since); switching (why you moved or why you stay; what broke; images; in-flight claims); AI (what you use, what it costs per use, what it got wrong).
4. *Reaction (10 min).* Show two ledger layouts (running vs itemized) and a daily bank-to-PMS reconciliation alert; ask what they would trust and why. Show a published rate card vs a quote; ask how each changes their decision.
5. *Wrap-up (5 min).* What should I have asked? Who else in the office should I talk to?

**Analysis.** Affinity mapping per persona; JTBD statements; impact/effort scoring of gaps; a highlight reel; and a synthesis report that separates what each role says from what owners assume.

---

# Sources

**Dental PMS — market data, ownership, pricing**
- Medix Dental IT, "Dental Practice Management Software Market Data: What Is Actually Known" (Jul 31, 2026; updated Sep 1, 2026) — https://medixdental.com/dental-pms-market-data/
- Medix Dental IT, "What Dental Practice Management Software Actually Costs in 2026" (Sep 1, 2026) — https://medixdental.com/dental-practice-management-software-cost/
- Open Dental, Fees for Support and Services (read Sep 2, 2026) — https://www.opendental.com/site/fees.html
- Curve Dental, Pricing (read Sep 2, 2026) — https://www.curvedental.com/pricing ; About — https://curvedental.com/about ; FAQ — https://www.curvedental.com/faq ; G2 profile — https://www.g2.com/products/curve-hero/discuss
- Henry Schein One press releases: Aug 20, 2025; Dec 18, 2025; Mar 10, 2026; Jun 15, 2026; MCP layer (2026) — https://www.henryscheinone.com/about-us/press-release/ ; https://www.businesswire.com/news/home/20260309270533/en/
- Planet DDS / Synchrony release (Feb 18, 2026) — https://www.barchart.com/story/news/280336/ ; Planet DDS boilerplate — https://www.businesswire.com/news/home/20240709235889/en/
- CareStack — https://hello.carestack.com/discover-solutions ; Straumann — https://straumann.com/us/en/landing/carestack.html
- Patterson Eaglesoft page — https://www.pattersondental.com/cp/software/dental-practice-management-software/eaglesoft ; Fuse launch (2018) — https://www.businesswire.com/news/home/20180404005749/en/
- PracticeSignal, Dental Software Pricing 2026 (Mar 2026) — https://practicesignal.com/dental/pricing ; Dentrix negotiation guide — https://practicesignal.com/dental/negotiation/dentrix ; Eaglesoft vs Open Dental — https://practicesignal.com/dental/compare/eaglesoft-vs-open-dental ; Dentrix vs Eaglesoft — https://practicesignal.com/dental/compare/dentrix-vs-eaglesoft
- The Molar Report, Eaglesoft pricing and overview (May 2026) — https://www.themolarreport.com/learn/eaglesoft-pricing ; https://www.themolarreport.com/learn/what-is-eaglesoft
- Ainora, Eaglesoft subscription migration (Jul 2026) — https://ainora.lt/blog/eaglesoft-subscription-migration-what-dentists-need-to-know
- Siotek comparison (Apr 2026) — https://siotek.net/resources/dental-practice-management-software-comparison
- Lassie AI comparison (Jul 2026) — https://www.lassie.ai/blog/dental-pms-comparison
- Mordor Intelligence market report (Jul 2026) — https://www.mordorintelligence.com/industry-reports/dental-practice-management-software-market
- Future Market Insights (Jun 2025; treated as unreliable) — https://www.futuremarketinsights.com/reports/dental-practice-management-software-market
- PitchBook, Dovetail (out of business) — https://pitchbook.com/profiles/company/462370-78
- Wikipedia, Dentrix (FTC settlement) — https://en.wikipedia.org/wiki/Dentrix

**Dental PMS — complaints**
- RevUp Dental, "Best Dental Practice Management Software According to Dentists" (May 28, 2026; updated Aug 17, 2026) — https://revupdental.com/best-dental-practice-management-systems/
- Titan Web Agency, Top 10 DPMS (Jan 2026) — https://blog.titanwebagency.com/dental-management-software-reviews
- Capterra: Curve — https://www.capterra.com/p/98688/Curve-Dental-Hero/ ; Open Dental — https://www.capterra.co.uk/software/122350/open-dental
- G2 alternatives pages for Dentrix, Eaglesoft, Open Dental, Ascend, Denticon, CareStack, SoftDent
- Henry Schein 2023 cyberattack: DrBicuspid — https://www.drbicuspid.com/dental-business/industry-updates/article/15637291/ ; MDM — https://mdm.com/?p=174870 ; SC Magazine — https://www.scmagazine.com/brief/alphv-blackcat-targets-henry-schein-anew

**Dental embezzlement and controls**
- Prosperident, "ADA says Embezzlement is Increasing" — https://www.prosperident.com/ada-says-embezzlement-is-increasing/ ; "ADA Survey Addresses How Embezzlement is Discovered" — https://www.prosperident.com/ada-survey-addresses-how-embezzlement-is-discovered/
- Dentistry Today, "Post-Pandemic Fraud in Dental Practices" (May 2026) — https://www.dentistrytoday.com/post-pandemic-fraud-in-dental-practices/
- Journal of the Michigan Dental Association (Prosperident endorsement) — https://commons.ada.org/journalmichigandentalassociation/vol107/iss11/9/ ; vol106/iss11/9
- Zeldent — https://www.zeldent.com/ ; blog posts on statistics, prevention, audit trails (Apr–Jul 2026)

**Risk-management platforms**
- UnderDefense, Compliance Automation Pricing Guide (Aug 2026, Vendr data) — https://underdefense.com/blog/compliance-automation-pricing/
- InventiveHQ comparison (Aug 2026) — https://inventivehq.com/blog/compliance-automation-tools-comparison
- SecureLeap: SOC 2 tools guide; Drata pricing — https://www.secureleap.tech/blog/
- ComplianceRated, Vanta vs Drata (Mar 2026) — https://compliancerated.com/comparisons/vanta-vs-drata/
- SOC2Auditors: Drata review; Vanta vs Drata; Vanta alternatives — https://soc2auditors.org/insights/
- Cyber Sierra (competitor-authored; complaints quoted) — https://cybersierra.co/blog/vanta-drata-review/
- ComplyJet (competitor-authored) — https://www.complyjet.com/blog/vanta-vs-drata-2025
- Sprinto, Vanta pricing (competitor-authored) — https://sprinto.com/blog/vanta-pricing/
- SelectHub risk-management category (May 2026) — https://www.selecthub.com/c/risk-management-software/
- trio.dev buyer's guide (Jun 2026) — https://trio.dev/risk-management-software/
- Guideflow ERM list (Jun 2026) — https://www.guideflow.com/blog/enterprise-risk-management-software
- Riskonnect ERM list (Jul 2026; vendor-authored) — https://riskonnect.com/the-10-best-enterprise-risk-management-erm-software-platforms/
- LogicManager platform page — https://www.logicmanager.com/platform/
- SimpleRisk VAR pricing — https://www.simplerisk.com/node/243 ; G2 — https://www.g2.com/products/simplerisk
- Diligent ERM — https://www.diligent.com/products/enterprise-risk-management ; GRC guide — https://www.diligent.com/resources/guides/grc
- HackerNoon GRC list (Apr 2026) — https://hackernoon.com/best-grc-platforms-for-risk-and-compliance-in-2026
- Bright Defense, GRC tools for SMBs (Jul 2026) — https://www.brightdefense.com/resources/grc-tools-for-smbs-and-startups/
- ACFE, Fraud Risk Tools / COSO — https://www.acfe.com/fraud-resources/fraud-risk-tools---coso ; Guide 2nd ed. blog — https://www.acfe.com/acfe-insights-blog/blog-detail?s=fraud-risk-management-guide-second-edition-coso
- Journal of Accountancy, COSO generative-AI guidance (Feb 2026) — https://www.journalofaccountancy.com/news/2026/feb/coso-creates-audit-ready-guidance-for-governing-generative-ai/
- MindBridge, COSO-aligned internal control checklist (Jun 2026) — https://www.mindbridge.ai/blog/internal-control-checklist-coso-aligned-ai-enhanced-audit-ready/
- Xero fraud-prevention tips (Jun 2026) — https://www.xero.com/us/accountant-bookkeeper-guides/fraud-prevention-tips/
- EisnerAmper, controls in accounting software — https://www.eisneramper.com/insights/litigation-services/fraud-control-software-1115/
- GrowthForce, internal controls with QuickBooks — https://www.growthforce.com/blog/how-to-establish-internal-controls-with-quickbooks
- Consero, reduce fraud risk using QuickBooks (Mar 2026) — https://conseroglobal.com/resources/reduce-risk-fraud-quickbooks/
- Anders CPA (Nov 2025) — https://anderscpa.com/learn/blog/prevent-organizational-fraud/
- Optro (vendor) — https://optro.ai/blog/using-internal-controls-to-detect-and-prevent-fraud

**Added in v2 (Grok files and verification)**
- Grok Bot research package (Sep 2, 2026): `01-rankings-and-features.md`, `02-voice-of-dentists.md`, `03-well-vs-poorly.md` (uploaded by Blake; ingested as knowledge/sources/grok-*.md)
- Curve Dental, "Curve Dental Announces $200 Million R&D Investment" (Aug 20, 2026) — https://www.prnewswire.com/news-releases/curve-dental-announces-200-million-rd-investment-302856409.html ; Dentistry Today reprint — https://www.dentistrytoday.com/curve-dental-forecasts-major-dental-software-consolidation/
- Curve Dental, "Curve Dental Names Luke Anderson Chief Product Officer" (Aug 27, 2026; 6,000+ locations) — https://www.prnewswire.com/news-releases/curve-dental-names-luke-anderson-chief-product-officer-to-drive-next-phase-of-ai-driven-dental-software-innovation-302861860.html
- Becker's Dental, "Reimbursements, staffing and expenses among dentists' challenges for 2026" (ADA HPI Q4 2025; 751 respondents) — https://www.beckersdental.com/?p=21680
- ADA HPI, State of the U.S. Dental Economy Q4 2025 — https://www.ada.org/-/media/project/ada-organization/ada/ada-org/files/resources/research/hpi/state_us_dental_economy_q42025.pdf ; Q1 2025 Economic Outlook — https://www.ada.org/-/media/project/ada-organization/ada/ada-org/files/resources/research/hpi/q12025_economic_outlook_dentistry_main.pdf
- Dental Economics, "Findings from the 2025 Dental Economics–Levin Group Annual Practice Survey" (May 5, 2026) — https://www.dentaleconomics.com/practice/article/55368689/findings-from-the-2025-dental-economics-levin-group-annual-practice-survey
- Dentaltown, Townie Choice Awards 2025 (Software, Practice Management) — https://www.dentaltown.com/townie-choice-awards/results/2025/practice-management/6950/software-practice-management (blocks automated access; Grok-reported)
- KLAS Research, CareStack First Look (Mar 2024) — https://www.straumann.com/content/dam/media-center/straumann/en/documents/scientific-documentation/whitepaper/KLAS%20Research%20CareStack%20Report%20.pdf
- Forrester, Total Economic Impact of CareStack (Oct 2023, commissioned by Straumann) — https://www.straumann.com/content/dam/media-center/straumann/en/documents/scientific-documentation/case-report/Forrester%20TEI_of_CareStack.pdf
- Alta Voice, "The State of the Hygiene Appointment" (Jul 15, 2026) — https://www.accessnewswire.com/newsroom/en/healthcare-and-pharmaceutical/new-survey-reveals-wide-gap-between-dentists-and-hygienists-confidenc-1191678
- Zentist, 2026 Dental RCM Trends report release (Feb 23, 2026) — https://www.businesswire.com/news/home/20260223464785/en/58-of-Dental-Practices-Commit-to-Automation-New-2026-RCM-Report-Finds
- Patterson Eaglesoft Service Club support flyer — https://content.pattersondental.com/images/web/DSP/EQ%20Promos/Eaglesoft%20Support%20Flyer.pdf
- CareStack vs. Curve comparison page (2,000+ dentists; 25,000+ users; ISO 27001 badge) — https://carestack.com/dental-software/compare/carestack-vs-curve-dental
- Software Advice, Open Dental reviews (retrieved by Grok, Sep 2, 2026) — https://www.softwareadvice.com/dental/open-dental-profile/reviews/
- Open Dental, Eaglesoft conversion PDF (Jun 17, 2026; Grok-reported) — https://opendental.com/resources/conversions/conversioneaglesoft.pdf
- Planet DDS, "Expands Its Lead in Enterprise and Multi-Location DSO Adoption in 2025" (Jan 28, 2026) — https://www.businesswire.com/news/home/20260128483145/en/ ; Eastern Dental Management selects Denticon (Aug 12, 2025) — https://www.businesswire.com/news/home/20250812603744/en/
- Sensei support pages (SoftDent; PracticeWorks not sold to new customers) — https://gosensei.com/softdent-support/ ; https://gosensei.com/practiceworks-support/
- Easy Dental sunset corroboration — https://softwarefinder.com/emr-software/easy-dental ; https://www.extruct.ai/hub/easydental-com
- Group Dentistry Now (May 21, 2025) — https://www.groupdentistrynow.com/dso-group-blog/dental-technology-2025/ ; Planet DDS blogs (Soto; Colao) — https://www.planetdds.com/blog/top-trends-for-dsos-in-spring-2025/ ; https://www.planetdds.com/blog/dental-industry-outlook-for-2025/
- Elementera, dental practice software in 2026 (Jun 18, 2026) — https://www.elementera.com/blog/dental-practice-software-in-2026-us-canada
- DSN, Sensei Cloud reviews for OMS practices (competitor-authored) — https://www.dsn.com/sensei-cloud-reviews-oms-practices/
- review.dental, Curve Dental review (facts verified Jul 3, 2026) — https://review.dental/reviews/curve-dental

**Added in v3 (risk-management verification)**
- Patient Protect, "HIPAA compliance software, and how the market actually splits" (Sept 2026; competitor-authored market map; $39/$99 pricing verified) — https://patient-protect.com/hipaa-compliance-software
- California Dental Association, Abyde endorsed service (Jan 29, 2026) — https://www.cda.org/newsroom/endorsed-services/a-software-solution-to-achieve-hipaa-compliance-offered-as-a-new-cda-member-benefit/
- Venn, "17 HIPAA Compliance Software Solutions to Know in 2026" (Jul 2026) — https://www.venn.com/learn/hipaa-compliance/hipaa-compliance-software/
- Capterra, Abyde listing (starting $115/month) — https://www.capterra.com/p/202863/Abyde/
- AccountableHQ vs Compliancy Group (vendor comparison; "starts at $99/mo"; "$3,000+/yr") — https://accountablehq.com/accountable-vs-compliancy-group
- Medcurity pricing guide and Medcurity vs Accountable (vendor; $499/yr; competitor figures) — https://medcurity.com/hipaa-compliance-software-pricing-guide/ ; https://medcurity.com/medcurity-vs-accountable/
- Compliancy Group homepage (testimonials) — https://compliancy-group.com/
- Smart Training dental compliance packages (Basic $79/user/yr) — https://stcart.smarttraining.com/cart/product/details/dental-compliance-basic-training ; https://stcart.smarttraining.com/cart/product/details/dental-compliance-premium
- Dental Compliance Specialists — https://dentalcompliance.com/ ; SafeLink Consulting — https://safelinkconsulting.com/capabilities/industries/dental-practice/ ; Modern Practice Solutions — https://modernpracticesolutions.com/compliance-services/
- SmarterRisk, "Risk Management Software for Small Business: Why Most Options Fail You" (Oct 2025; vendor; $500/yr) — https://www.smarterrisk.com/blog/risk-management-software-blog/
- Coalition Control — https://www.coalitioninc.com/control ; free risk assessment — https://www.coalitioninc.com/free-risk-assessment
- Intuit, QuickBooks feature updates (Finance AI anomaly flags; Intuit Intelligence) — https://quickbooks.intuit.com/r/product-update/latest-quickbooks-feature-updates-since-summer-2025/
- Intuit Community, Positive Pay not available in QuickBooks Online — https://ooxbu36397.lithium.com/learn-support/forums/replypage/board-id/banking/message-id/29608
- 415 Group / SD Mayer, "How to use QuickBooks as a fraud detection tool" — https://www.415group.com/how-to-use-quickbooks-as-a-fraud-detection-tool ; https://sdmayer.com/resources/how-to-use-quickbooks-as-a-fraud-detection-tool
- The CPA Journal, "Fraud Risk Management Practices" (Aug 10, 2026) — https://www.cpajournal.com/2026/08/10/fraud-risk-management-practices-2/
- Small-business internal-control guides (2026): Friedman+Huey — https://fhassoc.com/internal-controls-prevent-employee-bookkeeping-fraud/ ; MZBPO — https://www.mzbpo.com/blog/internal-controls-small-business ; 8020 Consulting — https://8020consulting.com/blog/10-basic-internal-controls-small-business ; VAAS — https://www.vaasprofessionals.com/post/internal-controls-for-small-businesses-preventing-fraud-and-errors ; MSM Taxes — https://www.msmtaxes.com/small-business-bookkeeping-internal-controls-checklist ; Paychex — https://www.paychex.com/articles/management/fraud-prevention-solutions-for-small-business
- Beancount.io, AI fraud detection for small business (Jul 2026; cites Trustpair 2026 report; SMB tool price bands) — https://beancount.io/zh/blog/2026/07/26/ai-fraud-detection-small-business-real-time-continuous-auditing-guide
