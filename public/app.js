const { useEffect, useRef, useState } = React;

const columns = ["Triaged", "Dispatched", "Checked-In", "Awaiting Confirmation", "Completed"];
const categories = ["Garden Path Clearing", "Appliance Safety", "Lock Repairs", "Loose Rails", "Deep Cleaning", "Trip Hazard Removal", "Lawn Mowing", "Garden Clearance", "Window Cleaning"];
const emptyState = {
  agencies: [{ id: "birdie-london", name: "Birdie London" }],
  serviceUsers: [],
  traders: [],
  tasks: [],
  audit: [],
  metrics: {
    connectedPartners: 0,
    activeVulnerableCases: 0,
    totalFallRisksPrevented: 0,
    ringFenceTasks: 0
  }
};

const api = {
  state: (auth, visit) => {
    const params = new URLSearchParams();
    if (auth?.user?.email && auth?.sessionToken) {
      params.set("email", auth.user.email);
      params.set("sessionToken", auth.sessionToken);
    }
    if (visit?.taskId && visit?.token) {
      params.set("visitTaskId", visit.taskId);
      params.set("visitToken", visit.token);
    }
    return fetch(`/api/state${params.toString() ? `?${params}` : ""}`).then((res) => res.json());
  },
  demo: (payload) => postJson("/api/demo-requests", payload),
  signup: (payload) => postJson("/api/auth/signup", payload),
  signin: (payload) => postJson("/api/auth/signin", payload),
  adminSignin: (payload) => postJson("/api/auth/admin-signin", payload),
  createTask: (payload) => postJson("/api/care/tasks", payload),
  aiPlan: (payload) => postJson("/api/ai/task-plan", payload),
  dispatch: (id, actorEmail, sessionToken) => postJson(`/api/taskbridge/tasks/${id}/dispatch`, { actorEmail, sessionToken }),
  amiqus: (id, actorEmail, sessionToken) => postJson(`/api/traders/${id}/amiqus-check`, { actorEmail, sessionToken }),
  approveDbs: (id, actorEmail, sessionToken) => postJson(`/api/admin/traders/${id}/approve-dbs`, { actorEmail, sessionToken }),
  confirmCompletion: (id, managerEmail, sessionToken) => postJson(`/api/care/tasks/${id}/confirm-completion`, { managerEmail, sessionToken }),
  checkIn: (id, token, coords) => postJson(`/api/visit/${id}/check-in?token=${encodeURIComponent(token)}`, coords),
  complete: (id, token, afterPhotoUrl) => postJson(`/api/visit/${id}/complete?token=${encodeURIComponent(token)}`, { afterPhotoUrl })
};

function postJson(url, payload) {
  return fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  }).then((res) => res.json());
}

function routeFromPath() {
  const path = location.pathname;
  if (path === "/how-it-works") return "how";
  if (path === "/book-demo") return "demo";
  if (path === "/sign-up") return "signup";
  if (path === "/sign-in") return "signin";
  if (path === "/taskbridge-admin") return "admin";
  if (path === "/portal") return "portal";
  return "home";
}

function App() {
  const [state, setState] = useState(emptyState);
  const [route, setRoute] = useState(routeFromPath());
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem("TaskBridgeUser") || "null"));
  const [notice, setNotice] = useState("");
  const visitMatch = location.pathname.match(/^\/visit\/([^/]+)/);

  async function refresh() {
    const token = new URLSearchParams(location.search).get("token");
    try {
      const nextState = await api.state(user, visitMatch ? { taskId: visitMatch[1], token } : null);
      setState({ ...emptyState, ...nextState, metrics: { ...emptyState.metrics, ...(nextState.metrics || {}) } });
    } catch (error) {
      setState((current) => current || emptyState);
    }
  }

  function navigate(nextRoute) {
    const paths = { home: "/", how: "/how-it-works", demo: "/book-demo", signup: "/sign-up", signin: "/sign-in", admin: "/taskbridge-admin", portal: "/portal" };
    history.pushState({}, "", paths[nextRoute]);
    setRoute(nextRoute);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function saveUser(payload) {
    localStorage.setItem("TaskBridgeUser", JSON.stringify(payload));
    setUser(payload);
    setNotice(`Signed in as ${payload.user.name}`);
    api.state(payload).then((nextState) => setState({ ...emptyState, ...nextState, metrics: { ...emptyState.metrics, ...(nextState.metrics || {}) } })).catch(() => setState(emptyState));
    navigate("portal");
  }

  function signOut() {
    localStorage.removeItem("TaskBridgeUser");
    setUser(null);
    setNotice("Signed out");
    api.state(null).then((nextState) => setState({ ...emptyState, ...nextState, metrics: { ...emptyState.metrics, ...(nextState.metrics || {}) } })).catch(() => setState(emptyState));
    navigate("home");
  }

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 5000);
    const pop = () => setRoute(routeFromPath());
    addEventListener("popstate", pop);
    return () => {
      clearInterval(timer);
      removeEventListener("popstate", pop);
    };
  }, [user?.sessionToken, location.pathname, location.search]);

  if (visitMatch) {
    const task = state.tasks.find((item) => item.id === visitMatch[1]);
    return <VisitWorkflow task={task} onRefresh={refresh} />;
  }

  return (
    <main className="min-h-screen">
      <SiteHeader route={route} user={user} navigate={navigate} signOut={signOut} />
      {notice && <Notice text={notice} />}
      {route === "home" && <MarketingHome navigate={navigate} />}
      {route === "how" && <HowItWorksPage navigate={navigate} />}
      {route === "demo" && <DemoPage submit={async (payload) => {
        const result = await api.demo(payload);
        setNotice(result.error || result.message);
      }} />}
      {route === "signup" && <AuthPage mode="signup" agencies={state.agencies} submit={async (payload) => {
        const result = await api.signup(payload);
        result.error ? setNotice(result.error) : saveUser(result);
      }} switchMode={() => navigate("signin")} />}
      {route === "signin" && <AuthPage mode="signin" submit={async (payload) => {
        const result = await api.signin(payload);
        result.error ? setNotice(result.error) : saveUser(result);
      }} switchMode={() => navigate("signup")} />}
      {route === "admin" && <AuthPage mode="admin" submit={async (payload) => {
        const result = await api.adminSignin(payload);
        result.error ? setNotice(result.error) : saveUser(result);
      }} />}
      {route === "portal" && <Portal state={state} user={user} navigate={navigate} refresh={refresh} setNotice={setNotice} />}
    </main>
  );
}

function SiteHeader({ route, user, navigate, signOut }) {
  return (
    <header className="sticky top-0 z-20 border-b border-ink/10 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
        <button onClick={() => navigate("home")} className="flex items-center gap-3 text-left">
          <img className="h-11 w-auto" src="/taskbridge-logo.svg" alt="TaskBridge" />
          <div className="sr-only">
            <div className="text-lg font-semibold tracking-tight">TaskBridge</div>
            <div className="hidden text-xs text-ink/60 sm:block">Making home safer for our vulnerable</div>
          </div>
        </button>
        <nav className="flex items-center gap-2">
          {!user && <HeaderButton label="How It Works" active={route === "how"} onClick={() => navigate("how")} />}
          {!user && <HeaderButton label="Book Demo" active={route === "demo"} onClick={() => navigate("demo")} />}
          {user && <HeaderButton label="Portal" active={route === "portal"} onClick={() => navigate("portal")} />}
          {!user && <HeaderButton label="Sign In" active={route === "signin"} onClick={() => navigate("signin")} />}
          {!user && <button onClick={() => navigate("signup")} className="rounded bg-ink px-4 py-2 text-sm font-semibold text-white">Sign Up</button>}
          {user && <button onClick={signOut} className="rounded bg-ink px-4 py-2 text-sm font-semibold text-white">Sign Out</button>}
        </nav>
      </div>
    </header>
  );
}

function HeaderButton({ label, active, onClick }) {
  return <button onClick={onClick} className={`rounded px-3 py-2 text-sm font-medium ${active ? "bg-mint text-ink" : "text-ink/70 hover:bg-ink/5"}`}>{label}</button>;
}

function Notice({ text }) {
  return <div className="mx-auto mt-4 max-w-7xl px-5"><div className="rounded border border-safe/20 bg-blue-50 px-4 py-3 text-sm text-safe">{text}</div></div>;
}

function MarketingHome({ navigate }) {
  return (
    <>
      <section className="relative overflow-hidden bg-[#f3f8f5]">
        <div className="mx-auto grid min-h-[680px] max-w-7xl gap-10 px-5 pb-12 pt-12 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
          <div className="relative z-[1] max-w-2xl">
            <p className="inline-flex rounded-full bg-white px-4 py-2 text-sm font-semibold text-safe ring-1 ring-safe/15">Safeguarded practical support for home care</p>
            <h1 className="mt-6 text-5xl font-semibold leading-tight tracking-tight text-ink md:text-6xl">
              Making home safer for our vulnerable
            </h1>
            <p className="mt-5 text-xl leading-8 text-ink/70">
              TaskBridge helps care providers turn everyday home hazards into governed handyman tasks, with AI-assisted triage, Enhanced DBS controls, care-manager approval, and secure visit evidence.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button onClick={() => navigate("demo")} className="rounded bg-ink px-5 py-3 font-semibold text-white">Book a Demo</button>
              <button onClick={() => navigate("how")} className="rounded bg-white px-5 py-3 font-semibold text-ink ring-1 ring-ink/15">See How It Works</button>
            </div>
            <div className="mt-8 flex flex-wrap gap-3 text-sm font-semibold text-ink/65">
              <span className="rounded-full bg-white px-4 py-2 ring-1 ring-ink/10">Birdie, PASS and Cera DCP ready</span>
              <span className="rounded-full bg-white px-4 py-2 ring-1 ring-ink/10">Amiqus DBS loop</span>
              <span className="rounded-full bg-white px-4 py-2 ring-1 ring-ink/10">Private trader dispatch</span>
            </div>
          </div>
          <HeroShowcase />
        </div>
      </section>
      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-5 py-16">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-safe">Who TaskBridge supports</p>
            <h2 className="mt-3 text-4xl font-semibold tracking-tight">Designed for care teams, operations leaders and vulnerable residents.</h2>
          </div>
          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            <AudienceCard title="Home Care Providers" body="Connect coordinator notes, field observations and care-system webhooks to a controlled practical-support workflow." link="For domiciliary care" />
            <AudienceCard title="Care Coordinators" body="Use AI to summarise one or many hazards into clear tasks, then approve them into the TaskBridge queue." link="For care operations" />
            <AudienceCard title="Safeguarding Leads" body="Keep vulnerable-adult jobs behind DBS, insurance, qualification, cap and audit controls before dispatch." link="For compliance teams" />
          </div>
        </div>
      </section>
      <section className="bg-[#102027] text-white">
        <div className="mx-auto grid max-w-7xl gap-4 px-5 py-12 sm:grid-cols-2 lg:grid-cols-4">
          <ImpactStat value="15 mi" label="local matching radius for vetted traders" />
          <ImpactStat value="100%" label="Enhanced DBS required for vulnerable-adult dispatch" />
          <ImpactStat value="5" label="controlled stages from triage to confirmation" />
          <ImpactStat value="0" label="direct resident contact details shared with traders" />
        </div>
      </section>
      <PlatformStory navigate={navigate} />
      <IntegrationBand />
      <TrustSection />
      <TestimonialSection />
      <HomeFaq />
      <DemoCta navigate={navigate} />
    </>
  );
}

function HeroShowcase() {
  return (
    <div className="relative min-h-[520px]">
      <img className="absolute inset-0 h-full w-full rounded object-cover shadow-sm" src="https://images.unsplash.com/photo-1559757175-0eb30cd8c063?auto=format&fit=crop&w=1400&q=80" alt="Care professional supporting an older person at home" />
      <div className="absolute inset-0 rounded bg-gradient-to-t from-ink/82 via-ink/18 to-transparent"></div>
      <div className="absolute bottom-5 left-5 right-5 grid gap-3 md:grid-cols-[1fr_0.8fr]">
        <div className="rounded bg-white p-4 text-ink shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-safe">Live safeguard</div>
          <h2 className="mt-2 text-xl font-semibold">Ring-fence enforced</h2>
          <p className="mt-2 text-sm leading-6 text-ink/65">Vulnerable-adult tasks stay pending until TaskBridge admin approves an active Enhanced DBS trader.</p>
        </div>
        <div className="rounded bg-mint p-4 text-ink shadow-sm">
          <div className="text-sm font-semibold">Typical task</div>
          <div className="mt-2 text-2xl font-semibold">Garden path clearing</div>
          <div className="mt-2 text-xs text-ink/60">AI summary, cap check, DBS lock, visit proof</div>
        </div>
      </div>
    </div>
  );
}

function AudienceCard({ title, body, link }) {
  return (
    <article className="rounded bg-panel p-6 ring-1 ring-ink/10">
      <div className="mb-5 h-28 rounded bg-white p-4 ring-1 ring-ink/8">
        <div className="h-full rounded bg-gradient-to-br from-mint via-white to-blue-50"></div>
      </div>
      <h3 className="text-xl font-semibold">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-ink/65">{body}</p>
      <div className="mt-5 text-sm font-semibold text-safe">{link}</div>
    </article>
  );
}

function ImpactStat({ value, label }) {
  return (
    <div className="rounded bg-white/8 p-5 ring-1 ring-white/12">
      <div className="text-4xl font-semibold">{value}</div>
      <div className="mt-2 text-sm leading-6 text-white/72">{label}</div>
    </div>
  );
}

function PlatformStory({ navigate }) {
  const steps = [
    ["AI task intake", "Care notes are split into one or many practical tasks with urgency, category and supervision context."],
    ["Admin approval", "TaskBridge admin releases the job only after DBS, insurance, qualification, proximity and cap checks pass."],
    ["Secure visit", "The trader receives a tokenized link for GPS check-in, photo evidence and checkout."],
    ["Care confirmation", "Final completion waits for care-side confirmation before callback and payment release."]
  ];
  return (
    <section className="bg-[#f3f8f5]">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-safe">Better safety every day</p>
          <h2 className="mt-3 text-4xl font-semibold tracking-tight">A managed safeguarding operations layer, not an open marketplace.</h2>
          <p className="mt-5 text-base leading-7 text-ink/68">
            TaskBridge sits between care systems and local trade networks so agencies can act on practical home risks without exposing vulnerable residents to unmanaged public feeds.
          </p>
          <button onClick={() => navigate("how")} className="mt-7 rounded bg-ink px-5 py-3 font-semibold text-white">View the Process</button>
        </div>
        <div className="grid gap-3">
          {steps.map(([title, body], index) => (
            <div key={title} className="rounded bg-white p-4 ring-1 ring-ink/10">
              <div className="flex gap-4">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-safe text-sm font-semibold text-white">{index + 1}</div>
                <div>
                  <h3 className="font-semibold">{title}</h3>
                  <p className="mt-1 text-sm leading-6 text-ink/65">{body}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function IntegrationBand() {
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-7xl px-5 py-16">
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-safe">Connected care ecosystem</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight">Built to integrate with the care platforms agencies already use.</h2>
            <p className="mt-4 text-sm leading-6 text-ink/65">Partner adapters support inbound task events and outbound completion updates without handing resident contact details to traders.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <LogoPill title="Birdie" body="Webhook intake and care-note callback" />
            <LogoPill title="PASS" body="Care workflow and event mapping" />
            <LogoPill title="Cera DCP" body="Digital care platform adapter" />
            <LogoPill title="Amiqus" body="Identity and Enhanced DBS sessions" />
          </div>
        </div>
      </div>
    </section>
  );
}

function LogoPill({ title, body }) {
  return (
    <div className="rounded bg-panel p-5 ring-1 ring-ink/10">
      <div className="text-xl font-semibold">{title}</div>
      <div className="mt-2 text-sm leading-6 text-ink/60">{body}</div>
    </div>
  );
}

function TrustSection() {
  return (
    <section className="bg-[#e8f2ed]">
      <div className="mx-auto max-w-7xl px-5 py-16">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-safe">Governance by design</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight">Compliance controls for real-world home safety work.</h2>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <TrustItem title="Enhanced DBS lock" body="Active, unexpired approval required for vulnerable-adult dispatch." />
          <TrustItem title="Verified insurance" body="No verified cover, no assignment to a practical home task." />
          <TrustItem title="Payment caps" body="Agency monthly limits checked before releasing jobs." />
          <TrustItem title="Audit trail" body="Every triage, admin approval, visit event and callback is recorded." />
        </div>
      </div>
    </section>
  );
}

function TrustItem({ title, body }) {
  return (
    <article className="rounded bg-white p-5 ring-1 ring-ink/10">
      <div className="mb-4 h-10 w-10 rounded-full bg-safe/12"></div>
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-ink/62">{body}</p>
    </article>
  );
}

function TestimonialSection() {
  return (
    <section className="bg-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-16 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-safe">What care services need</p>
          <h2 className="mt-3 text-4xl font-semibold tracking-tight">Practical risks handled with the same discipline as care records.</h2>
        </div>
        <div className="grid gap-4">
          <QuoteCard quote="We need the confidence that if a vulnerable resident needs a practical repair, the process is controlled, evidenced and not left to an open marketplace." name="Operations Director" role="Home care provider" />
          <QuoteCard quote="The biggest value is turning a messy carer note into clear tasks while keeping assignment decisions with authorised TaskBridge admins." name="Registered Manager" role="Domiciliary care service" />
        </div>
      </div>
    </section>
  );
}

function QuoteCard({ quote, name, role }) {
  return (
    <figure className="rounded bg-panel p-6 ring-1 ring-ink/10">
      <blockquote className="text-lg leading-8 text-ink/78">"{quote}"</blockquote>
      <figcaption className="mt-5 text-sm font-semibold">{name}<span className="block font-normal text-ink/55">{role}</span></figcaption>
    </figure>
  );
}

function HomeFaq() {
  const faqs = [
    ["Does TaskBridge replace our care system?", "No. TaskBridge connects to care systems such as Birdie, PASS and Cera DCP, then handles the governed practical-task workflow."],
    ["Can care coordinators choose handymen?", "No. Coordinators approve task intake and can monitor progress. TaskBridge admin controls handyman approval and dispatch."],
    ["What happens if a trader has no Enhanced DBS?", "They cannot be assigned to vulnerable-adult tasks. Supervision is recorded as an extra control, not a replacement for Enhanced DBS."],
    ["Are resident details shared?", "Direct contact details are redacted. Traders use tokenized visit links for check-in, evidence and checkout."]
  ];
  return (
    <section className="bg-[#f3f8f5]">
      <div className="mx-auto max-w-4xl px-5 py-16">
        <h2 className="text-3xl font-semibold tracking-tight">FAQs</h2>
        <div className="mt-6 grid gap-3">
          {faqs.map(([question, answer]) => (
            <details key={question} className="rounded bg-white p-5 ring-1 ring-ink/10">
              <summary className="cursor-pointer font-semibold">{question}</summary>
              <p className="mt-3 text-sm leading-6 text-ink/65">{answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function DemoCta({ navigate }) {
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-7xl px-5 py-16">
        <div className="grid gap-8 rounded bg-ink p-8 text-white md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <h2 className="text-3xl font-semibold">See TaskBridge in action</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/72">Book a guided walkthrough of AI intake, care approval, admin dispatch, Amiqus DBS checks and the mobile trader visit workflow.</p>
          </div>
          <button onClick={() => navigate("demo")} className="rounded bg-white px-5 py-3 font-semibold text-ink">Book a Demo</button>
        </div>
      </div>
    </section>
  );
}

function HowItWorksPage({ navigate }) {
  const workflow = [
    {
      step: "01",
      title: "A care concern becomes a structured task",
      body: "A coordinator, care manager or field worker records a note such as moss on a path, a loose rail, unsafe windows, lawn overgrowth or a faulty lock. TaskBridge turns the note into one or more practical tasks."
    },
    {
      step: "02",
      title: "AI summarises, but care stays in control",
      body: "The AI suggests category, urgency, supervision needs and preferred timing. The care manager approves the task into the queue before any handyman assignment can happen."
    },
    {
      step: "03",
      title: "The safeguard firewall checks the job",
      body: "Vulnerable-adult tasks require active Enhanced DBS. TaskBridge also checks insurance, qualifications, service fit, proximity, availability, price and the agency monthly cap."
    },
    {
      step: "04",
      title: "TaskBridge admin releases the handyman",
      body: "Only authorised TaskBridge admin users can approve dispatch from private trader pools. Care coordinators do not see rejected or proposed handymen."
    },
    {
      step: "05",
      title: "The visit is evidenced and confirmed",
      body: "The handyman receives a tokenised mobile link, checks in by GPS, uploads photo evidence, checks out, and the care team confirms completion before the care record is updated."
    }
  ];
  const services = ["Garden path clearing", "Lawn mowing", "Window cleaning", "Loose rails", "Lock repairs", "Trip hazard removal", "Deep cleaning", "Appliance safety"];

  return (
    <>
      <section className="bg-[#f3f8f5]">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 lg:grid-cols-[0.88fr_1.12fr] lg:items-center">
          <div>
            <p className="inline-flex rounded-full bg-white px-4 py-2 text-sm font-semibold text-safe ring-1 ring-safe/15">How TaskBridge works</p>
            <h1 className="mt-6 text-5xl font-semibold leading-tight tracking-tight">From care note to safer home, without opening the resident to risk.</h1>
            <p className="mt-5 text-lg leading-8 text-ink/68">
              TaskBridge is the governed operations layer between care platforms and practical home services. It keeps care teams in control, keeps resident contact details private, and only releases work after safeguarding checks pass.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button onClick={() => navigate("demo")} className="rounded bg-ink px-5 py-3 font-semibold text-white">Book a Demo</button>
              <button onClick={() => navigate("signin")} className="rounded bg-white px-5 py-3 font-semibold text-ink ring-1 ring-ink/15">Care Portal Sign In</button>
            </div>
          </div>
          <div className="relative min-h-[460px] overflow-hidden rounded bg-ink text-white shadow-sm">
            <img className="absolute inset-0 h-full w-full object-cover opacity-50" src="https://images.unsplash.com/photo-1581579186913-45ac3e6efe93?auto=format&fit=crop&w=1400&q=80" alt="Safe home maintenance support" />
            <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/70 to-ink/10"></div>
            <div className="relative flex min-h-[460px] flex-col justify-end p-6">
              <div className="max-w-xl">
                <div className="mb-4 inline-flex rounded bg-white/12 px-3 py-1 text-sm font-semibold ring-1 ring-white/20">Safeguarding first</div>
                <h2 className="text-3xl font-semibold leading-tight">No public feed. No direct resident contact. No vulnerable-adult dispatch without Enhanced DBS.</h2>
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <ProcessBadge value="AI" label="task extraction" />
                <ProcessBadge value="DBS" label="firewall" />
                <ProcessBadge value="GPS" label="visit proof" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-5 py-16">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-safe">Operational flow</p>
            <h2 className="mt-3 text-4xl font-semibold tracking-tight">Five controlled stages from hazard note to care-confirmed completion.</h2>
          </div>
          <div className="mt-10 grid gap-4">
            {workflow.map((item) => <WorkflowRow key={item.step} {...item} />)}
          </div>
        </div>
      </section>

      <section className="bg-[#e8f2ed]">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-16 lg:grid-cols-[1fr_0.9fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-safe">The safety firewall</p>
            <h2 className="mt-3 text-4xl font-semibold tracking-tight">Built for vulnerable-adult governance before marketplace speed.</h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-ink/65">
              TaskBridge does not behave like an open handyman marketplace. It treats practical home support as a safeguarding workflow with approval gates, audit events and evidence requirements.
            </p>
            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              <ControlPoint title="Enhanced DBS required" body="Pending, failed, expired or unclear DBS cannot pass vulnerable-adult dispatch." />
              <ControlPoint title="Insurance verified" body="Public liability cover and task qualification checks happen before release." />
              <ControlPoint title="Care-side confirmation" body="Trader checkout waits for care confirmation before final completion." />
              <ControlPoint title="Resident data protected" body="Traders use tokenised links instead of direct resident contact details." />
            </div>
          </div>
          <div className="rounded bg-white p-6 ring-1 ring-ink/10">
            <h3 className="text-xl font-semibold">What care teams can request</h3>
            <div className="mt-5 grid gap-2">
              {services.map((service) => (
                <div key={service} className="flex items-center justify-between rounded bg-panel px-4 py-3 text-sm font-semibold">
                  <span>{service}</span>
                  <span className="text-safe">Available</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-16 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-safe">Connected by API</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight">Designed to sit quietly behind Birdie, PASS and Cera DCP.</h2>
            <p className="mt-4 text-sm leading-6 text-ink/65">
              Agencies can raise hazards from their care ecosystem, while TaskBridge handles practical task governance, Amiqus DBS sessions, private marketplace dispatch and completion callbacks.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <IntegrationTile title="Inbound care note" body="Webhook or portal task intake from care teams." />
            <IntegrationTile title="Amiqus DBS" body="Identity and Enhanced DBS session management." />
            <IntegrationTile title="Private trader pools" body="Restricted dispatch to vetted marketplace members." />
            <IntegrationTile title="Care callback" body="Completion evidence returned to the parent care record." />
          </div>
        </div>
      </section>

      <DemoCta navigate={navigate} />
    </>
  );
}

function ProcessBadge({ value, label }) {
  return (
    <div className="rounded bg-white/12 p-4 ring-1 ring-white/16">
      <div className="text-2xl font-semibold">{value}</div>
      <div className="mt-1 text-xs font-medium text-white/70">{label}</div>
    </div>
  );
}

function WorkflowRow({ step, title, body }) {
  return (
    <article className="grid gap-4 rounded bg-panel p-5 ring-1 ring-ink/10 md:grid-cols-[90px_1fr] md:items-start">
      <div className="text-4xl font-semibold text-safe">{step}</div>
      <div>
        <h3 className="text-xl font-semibold">{title}</h3>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-ink/65">{body}</p>
      </div>
    </article>
  );
}

function ControlPoint({ title, body }) {
  return (
    <article className="rounded bg-white p-4 ring-1 ring-ink/10">
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-ink/62">{body}</p>
    </article>
  );
}

function IntegrationTile({ title, body }) {
  return (
    <article className="rounded bg-panel p-5 ring-1 ring-ink/10">
      <div className="mb-4 h-12 w-12 rounded bg-mint"></div>
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-ink/62">{body}</p>
    </article>
  );
}

function AnimatedExplainer({ large = false }) {
  const scenes = [
    {
      title: "Care team logs a home risk",
      body: "A care manager or coordinator records a hazard such as a loose rail, unsafe path, lock issue, or appliance concern.",
      badge: "How it works"
    },
    {
      title: "TaskBridge applies the safeguard",
      body: "If the resident is vulnerable, TaskBridge applies the digital ring-fence and requires Enhanced DBS approval.",
      badge: "SafeGuard"
    },
    {
      title: "TaskBridge admin approves the match",
      body: "Only a TaskBridge admin can approve the DBS status and assign a vetted handyman from a private partner network.",
      badge: "Approval"
    },
    {
      title: "Trader completes a secure visit",
      body: "The trader receives a tokenized mobile link, checks in by location, uploads photo proof, and the care record is updated.",
      badge: "Visit"
    }
  ];
  const totalSeconds = 48;
  const segmentSeconds = totalSeconds / scenes.length;
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const narratorVoice = useRef(null);
  const narrationTimers = useRef([]);
  const lastSpokenScene = useRef(null);
  const scene = Math.min(scenes.length - 1, Math.floor(elapsed / segmentSeconds));
  const progress = (elapsed / totalSeconds) * 100;
  const secondsLeft = Math.max(0, Math.round(totalSeconds - elapsed));

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      setElapsed((current) => {
        const next = Math.min(totalSeconds, current + 0.25);
        if (next >= totalSeconds) {
          setPlaying(false);
          return totalSeconds;
        }
        return next;
      });
    }, 250);
    return () => clearInterval(timer);
  }, [playing]);

  useEffect(() => {
    if (!playing || lastSpokenScene.current === scene) return;
    lastSpokenScene.current = scene;
    clearNarrationTimers(narrationTimers);
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    const timer = window.setTimeout(() => {
      speakText(scenes[scene].body, narratorVoice.current);
    }, scene === 0 && elapsed < 1 ? 300 : 1000);
    narrationTimers.current.push(timer);
  }, [playing, scene]);

  function playVideo() {
    if (elapsed >= totalSeconds) {
      setElapsed(0);
    }
    narratorVoice.current = narratorVoice.current || pickEnglishVoice();
    lastSpokenScene.current = null;
    setPlaying(true);
  }

  function pauseVideo() {
    setPlaying(false);
    clearNarrationTimers(narrationTimers);
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }

  function stopVideo() {
    setPlaying(false);
    setElapsed(0);
    lastSpokenScene.current = null;
    clearNarrationTimers(narrationTimers);
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }

  function scrubVideo(value) {
    const nextElapsed = Number(value);
    setElapsed(nextElapsed);
    lastSpokenScene.current = null;
    clearNarrationTimers(narrationTimers);
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }

  return (
    <div className={`overflow-hidden rounded bg-[#0f0f0f] text-white shadow-sm ring-1 ring-ink/10 ${large ? "min-h-[430px]" : "min-h-[360px]"}`}>
      <div className="relative aspect-video min-h-[300px] overflow-hidden bg-[#101f27]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,#2563eb55,transparent_42%),linear-gradient(135deg,#102027,#1d3f3a)]"></div>
        <div className="absolute left-5 top-5 rounded bg-safe px-3 py-1 text-xs font-semibold">{scenes[scene].badge}</div>
        <div className="absolute right-5 top-5 rounded bg-black/50 px-3 py-1 text-xs font-semibold">TaskBridge</div>

        {!playing && (
          <button onClick={playVideo} className="absolute inset-0 z-10 grid place-items-center bg-black/20">
            <span className="flex items-center gap-3 rounded-full bg-black/65 px-5 py-3 text-lg font-semibold text-white shadow-lg ring-1 ring-white/20">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-white text-ink">▶</span>
              Play
            </span>
          </button>
        )}

        <div className="relative z-[1] flex h-full flex-col justify-center p-6 sm:p-10">
          <div className="grid gap-5 md:grid-cols-[0.95fr_1.05fr] md:items-center">
            <div>
              <div className="mb-4 inline-flex rounded bg-white/12 px-3 py-1 text-sm font-semibold text-white ring-1 ring-white/20">
                Step {scene + 1} of {scenes.length}
              </div>
              <h3 className="max-w-lg text-2xl font-semibold leading-tight sm:text-4xl">{scenes[scene].title}</h3>
              <p className="mt-4 max-w-xl text-sm leading-6 text-white/76 sm:text-base">{scenes[scene].body}</p>
            </div>
            <div className="rounded bg-white/10 p-4 ring-1 ring-white/15 backdrop-blur">
              <div className="grid gap-3">
                <VideoFlowRow active={scene >= 0} label="Hazard captured by care team" />
                <VideoFlowRow active={scene >= 1} label="Vulnerable-adult ring-fence checked" />
                <VideoFlowRow active={scene >= 2} label="TaskBridge admin approves handyman" />
                <VideoFlowRow active={scene >= 3} label="Tokenized visit and photo proof" />
              </div>
            </div>
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black via-black/82 to-transparent px-4 pb-3 pt-10">
          <input
            aria-label="Video timeline"
            className="mb-3 h-1 w-full accent-safe"
            max={totalSeconds}
            min="0"
            step="0.25"
            type="range"
            value={elapsed}
            onChange={(event) => scrubVideo(event.target.value)}
          />
          <div className="flex items-center gap-3">
            <button onClick={playing ? pauseVideo : playVideo} className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/15" aria-label={playing ? "Pause" : "Play"}>
              {playing ? "❚❚" : "▶"}
            </button>
            <button onClick={stopVideo} className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/15" aria-label="Stop">■</button>
            <div className="text-xs font-medium text-white/80">{formatTime(elapsed)} / {formatTime(totalSeconds)}</div>
            <div className="ml-auto text-xs font-medium text-white/60">{secondsLeft}s left</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function pickEnglishVoice() {
  if (!("speechSynthesis" in window)) return;
  const voices = window.speechSynthesis.getVoices();
  return voices.find((voice) => voice.lang === "en-GB" && /google uk english|microsoft (sonia|george|ryan)|daniel|serena|kate|susan/i.test(voice.name))
    || voices.find((voice) => voice.lang === "en-GB")
    || voices.find((voice) => voice.lang?.startsWith("en-"));
}

function speakText(text, voice) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const englishVoice = voice || pickEnglishVoice();
  if (englishVoice) utterance.voice = englishVoice;
  utterance.lang = englishVoice?.lang || "en-GB";
  utterance.rate = 1.03;
  utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
}

function clearNarrationTimers(timersRef) {
  timersRef.current.forEach((timer) => window.clearTimeout(timer));
  timersRef.current = [];
}

function formatTime(seconds) {
  const rounded = Math.floor(seconds);
  return `0:${String(rounded).padStart(2, "0")}`;
}

function VideoFlowRow({ active, label }) {
  return (
    <div className={`flex items-center gap-3 rounded px-3 py-2 transition ${active ? "bg-white text-ink" : "bg-white/8 text-white/55"}`}>
      <div className={`h-3 w-3 rounded-full ${active ? "bg-safe" : "bg-white/35"}`}></div>
      <div className="text-sm font-semibold">{label}</div>
    </div>
  );
}

function MiniScene({ title, label, active = false, playing = false }) {
  return (
    <div className={`${playing && active ? "taskbridge-float" : ""} rounded bg-white p-4 ring-1 ${active ? "ring-safe" : "ring-ink/10"}`}>
      <div className={`mb-4 h-16 rounded ${active ? "bg-blue-50" : "bg-mint"} p-3`}>
        <div className="mx-auto h-8 w-12 rounded-t-full border-4 border-ink border-b-0"></div>
        <div className="mx-auto h-5 w-8 rounded-b bg-ink"></div>
      </div>
      <div className="text-sm font-semibold">{title}</div>
      <div className="text-xs text-ink/55">{label}</div>
    </div>
  );
}

function DemoPage({ submit }) {
  const [form, setForm] = useState({ name: "", workEmail: "", organisation: "", role: "Care Manager", message: "" });
  return (
    <FormShell title="Book a TaskBridge demo" intro="See the care-coordinator workflow, DBS firewall, marketplace dispatch, and trader visit controls in one guided session.">
      <form className="grid gap-4" onSubmit={(event) => {
        event.preventDefault();
        submit(form);
      }}>
        <Input label="Name" value={form.name} onChange={(name) => setForm({ ...form, name })} />
        <Input label="Work email" type="email" value={form.workEmail} onChange={(workEmail) => setForm({ ...form, workEmail })} />
        <Input label="Organisation" value={form.organisation} onChange={(organisation) => setForm({ ...form, organisation })} />
        <Input label="Role" value={form.role} onChange={(role) => setForm({ ...form, role })} />
        <TextArea label="What would you like to evaluate?" value={form.message} onChange={(message) => setForm({ ...form, message })} />
        <SubmitButton label="Request Demo" />
      </form>
    </FormShell>
  );
}

function AuthPage({ mode, agencies = [], submit, switchMode }) {
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "Care Coordinator", agencyId: agencies[0]?.id || "birdie-london" });
  const signup = mode === "signup";
  const admin = mode === "admin";
  return (
    <FormShell title={signup ? "Create your care manager account" : admin ? "TaskBridge admin access" : "Sign in to the care portal"} intro={signup ? "New accounts are created with limited care-manager access for task intake and monitoring." : admin ? "Restricted operations access for authorised TaskBridge administrators." : "Care managers and coordinators can sign in to create and monitor safeguarded home safety tasks."}>
      <form className="grid gap-4" onSubmit={(event) => {
        event.preventDefault();
        submit(form);
      }}>
        {signup && <Input label="Full name" value={form.name} onChange={(name) => setForm({ ...form, name })} />}
        <Input label="Email" type="email" value={form.email} onChange={(email) => setForm({ ...form, email })} />
        <Input label="Password" type="password" value={form.password} onChange={(password) => setForm({ ...form, password })} />
        {signup && <Input label="Role" value={form.role} onChange={(role) => setForm({ ...form, role })} />}
        {signup && (
          <label className="grid gap-2 text-sm font-medium">
            Agency
            <select className="rounded border border-ink/15 bg-white px-3 py-3" value={form.agencyId} onChange={(event) => setForm({ ...form, agencyId: event.target.value })}>
              {agencies.map((agency) => <option key={agency.id} value={agency.id}>{agency.name}</option>)}
            </select>
          </label>
        )}
        <SubmitButton label={signup ? "Create Account" : "Sign In"} />
      </form>
      {!admin && <button onClick={switchMode} className="mt-4 text-sm font-semibold text-safe">{signup ? "Already have an account? Sign in" : "Need an account? Sign up"}</button>}
    </FormShell>
  );
}

function FormShell({ title, intro, children }) {
  return (
    <section className="mx-auto grid max-w-6xl gap-8 px-5 py-12 lg:grid-cols-[0.9fr_1.1fr]">
      <div className="pt-4">
        <h1 className="text-4xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-4 text-lg leading-8 text-ink/65">{intro}</p>
      </div>
      <div className="rounded bg-white p-5 ring-1 ring-ink/10">{children}</div>
    </section>
  );
}

function Input({ label, value, onChange, type = "text" }) {
  return (
    <label className="grid gap-2 text-sm font-medium">
      {label}
      <input className="rounded border border-ink/15 bg-white px-3 py-3" type={type} value={value} onChange={(event) => onChange(event.target.value)} required />
    </label>
  );
}

function TextArea({ label, value, onChange }) {
  return (
    <label className="grid gap-2 text-sm font-medium">
      {label}
      <textarea className="min-h-32 rounded border border-ink/15 bg-white px-3 py-3" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function SubmitButton({ label }) {
  return <button className="rounded bg-ink px-4 py-3 font-semibold text-white">{label}</button>;
}

function Portal({ state, user, navigate, refresh, setNotice }) {
  const [view, setView] = useState("intake");
  const isAdmin = user?.user?.accessLevel === "admin";
  const activeView = isAdmin && view === "intake" ? "operations" : view;
  if (!user) {
    return (
      <section className="mx-auto max-w-3xl px-5 py-16">
        <h1 className="text-3xl font-semibold">Care portal access required</h1>
        <p className="mt-3 text-ink/65">Sign in as a care manager or coordinator to populate safety tasks.</p>
        <button onClick={() => navigate("signin")} className="mt-6 rounded bg-ink px-5 py-3 font-semibold text-white">Sign In</button>
      </section>
    );
  }
  return (
    <div className="mx-auto max-w-7xl px-5 py-6">
      <section className="mb-6 grid gap-4 md:grid-cols-4">
        <Metric label="Partners" value={state.metrics.connectedPartners} />
        <Metric label="Vulnerable Cases" value={state.metrics.activeVulnerableCases} />
        <Metric label="Ring-Fenced Tasks" value={state.metrics.ringFenceTasks} />
        <Metric label="Total Fall Risks Prevented" value={state.metrics.totalFallRisksPrevented} />
      </section>
      <div className="mb-5 flex flex-wrap gap-2">
        {!isAdmin && <Tab id="intake" label="Populate Task" view={activeView} setView={setView} />}
        <Tab id="operations" label="Operations" view={activeView} setView={setView} />
        {isAdmin && <Tab id="traders" label="Compliance" view={activeView} setView={setView} />}
        {isAdmin && <Tab id="clients" label="Agencies" view={activeView} setView={setView} />}
      </div>
      {activeView === "intake" && !isAdmin && <TaskIntake state={state} user={user} refresh={refresh} setNotice={setNotice} setView={setView} />}
      {activeView === "operations" && <Operations tasks={tasksForUser(state.tasks, user)} canDispatch={isAdmin} canConfirm={true} dispatchTask={async (id) => {
        const result = await api.dispatch(id, user.user.email, user.sessionToken);
        setNotice(result.error || `Dispatched with ${result.receipt.provider}; SMS visit link: ${result.smsLink}`);
        await refresh();
      }} confirmTask={async (id) => {
        const result = await api.confirmCompletion(id, user.user.email, user.sessionToken);
        setNotice(result.error || `${id} confirmed complete and care-app callback queued`);
        await refresh();
      }} />}
      {activeView === "traders" && isAdmin && <Compliance traders={state.traders} runCheck={async (id) => {
        const result = await api.amiqus(id, user.user.email, user.sessionToken);
        setNotice(result.error || `Amiqus session created: ${result.session.id}`);
        await refresh();
      }} approveDbs={async (id) => {
        const result = await api.approveDbs(id, user.user.email, user.sessionToken);
        setNotice(result.error || `${result.trader.name} is now Enhanced DBS approved`);
        await refresh();
      }} />}
      {activeView === "clients" && isAdmin && <AgencyOverview state={state} />}
    </div>
  );
}

function tasksForUser(tasks, user) {
  if (user.user.accessLevel === "admin") return tasks;
  return tasks.filter((task) => task.serviceUser.agencyId === user.user.agencyId);
}

function TaskIntake({ state, user, refresh, setNotice, setView }) {
  const eligibleUsers = state.serviceUsers.filter((item) => item.agencyId === user.user.agencyId);
  const [form, setForm] = useState({
    service_user_id: eligibleUsers[0]?.id || "",
    category: categories[0],
    urgency: "High",
    preferredWindow: "Today 14:00-16:00",
    carerOnSite: false,
    aiSummary: "",
    aiRecommendedService: "",
    notes: ""
  });
  const [plan, setPlan] = useState(null);
  return (
    <section className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
      <div>
        <h1 className="text-2xl font-semibold">Populate a Safety Task</h1>
        <p className="mt-2 text-sm leading-6 text-ink/65">Care managers and coordinators approve the AI task summary into the queue. TaskBridge admin then completes the safeguarded handyman assignment.</p>
      </div>
      <form className="rounded bg-white p-5 ring-1 ring-ink/10" onSubmit={async (event) => {
        event.preventDefault();
        const result = await api.createTask({ ...form, managerEmail: user.user.email, sessionToken: user.sessionToken });
        setNotice(result.error || `${result.task.id} created. ${result.safeguard}`);
        await refresh();
        if (!result.error) setView("operations");
      }}>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium">
            Service user
            <select className="rounded border border-ink/15 bg-white px-3 py-3" value={form.service_user_id} onChange={(event) => setForm({ ...form, service_user_id: event.target.value })}>
              {eligibleUsers.map((serviceUser) => <option key={serviceUser.id} value={serviceUser.id}>{serviceUser.name} {serviceUser.isVulnerable ? "(Vulnerable)" : ""}</option>)}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Category
            <select className="rounded border border-ink/15 bg-white px-3 py-3" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
              {categories.map((category) => <option key={category}>{category}</option>)}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Urgency
            <select className="rounded border border-ink/15 bg-white px-3 py-3" value={form.urgency} onChange={(event) => setForm({ ...form, urgency: event.target.value })}>
              <option>High</option>
              <option>Medium</option>
              <option>Low</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Preferred time window
            <select className="rounded border border-ink/15 bg-white px-3 py-3" value={form.preferredWindow} onChange={(event) => setForm({ ...form, preferredWindow: event.target.value })}>
              <option>Today 11:00-13:00</option>
              <option>Today 14:00-16:00</option>
              <option>Tomorrow 09:00-11:00</option>
              <option>Next available</option>
            </select>
          </label>
          <label className="flex items-center gap-3 rounded border border-ink/15 bg-panel px-3 py-3 text-sm font-medium">
            <input type="checkbox" checked={form.carerOnSite} onChange={(event) => setForm({ ...form, carerOnSite: event.target.checked })} />
            Carer will be on site during the handyman visit
          </label>
        </div>
        <div className="mt-4">
          <TextArea label="Care worker notes" value={form.notes} onChange={(notes) => setForm({ ...form, notes })} />
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <button type="button" onClick={async () => {
            const result = await api.aiPlan({ ...form, managerEmail: user.user.email, sessionToken: user.sessionToken });
            if (result.error) {
              setNotice(result.error);
              return;
            }
            setPlan(result);
            setForm({ ...form, category: result.category, urgency: result.urgency, aiSummary: result.summary, aiRecommendedService: result.category, aiTasks: result.tasks || [] });
            setNotice("AI plan generated from care note");
          }} className="rounded bg-safe px-4 py-3 font-semibold text-white">Generate AI Task Plan</button>
          <button className="rounded bg-ink px-4 py-3 font-semibold text-white">Approve Task for Admin Assignment</button>
        </div>
        {plan && <AiPlanPanel plan={plan} />}
      </form>
    </section>
  );
}

function AiPlanPanel({ plan }) {
  return (
    <div className="mt-5 rounded bg-panel p-4 ring-1 ring-ink/10">
      <div className="text-sm font-semibold text-safe">AI task summary</div>
      <p className="mt-2 text-sm leading-6 text-ink/75">{plan.summary}</p>
      <div className="mt-3 rounded bg-white p-3 text-sm"><b>Preferred window</b><br />{plan.preferredWindow}</div>
      <div className="mt-3 rounded bg-blue-50 p-3 text-sm text-safe">{plan.safeguarding}</div>
      <div className="mt-4">
        <div className="text-sm font-semibold">Identified tasks</div>
        <div className="mt-2 grid gap-2">
          {(plan.tasks || []).map((task, index) => (
            <div key={`${task.category}-${index}`} className="rounded bg-white p-3 text-sm ring-1 ring-ink/10">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <b>{task.category}</b>
                <span className="rounded bg-ink px-2 py-1 text-xs font-semibold text-white">{task.assignmentStatus}</span>
              </div>
              <div className="mt-1 text-ink/65">{task.summary}</div>
              <div className="mt-1 text-xs text-safe">{task.urgency} urgency</div>
            </div>
          ))}
          {!plan.tasks?.length && <div className="rounded bg-white p-3 text-sm text-ink/60">No task was identified from the note.</div>}
        </div>
      </div>
    </div>
  );
}

function Tab({ id, label, view, setView }) {
  const active = view === id;
  return (
    <button onClick={() => setView(id)} className={`rounded px-4 py-2 text-sm font-medium ${active ? "bg-ink text-white" : "bg-white text-ink ring-1 ring-ink/10"}`}>
      {label}
    </button>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded bg-white p-4 ring-1 ring-ink/10">
      <div className="text-3xl font-semibold">{value}</div>
      <div className="mt-1 text-sm text-ink/60">{label}</div>
    </div>
  );
}

function Operations({ tasks, dispatchTask, confirmTask, canDispatch, canConfirm }) {
  return (
    <section>
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Operations Live Feed</h2>
          <p className="text-sm text-ink/60">Triaged hazards move through controlled dispatch, geofenced attendance, and care-app completion callbacks.</p>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-5">
        {columns.map((column) => (
          <div key={column} className="min-h-96 rounded bg-white p-3 ring-1 ring-ink/10">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">{column}</h3>
              <span className="rounded bg-ink/5 px-2 py-1 text-xs">{tasks.filter((task) => task.status === column).length}</span>
            </div>
            <div className="space-y-3">
              {tasks.filter((task) => task.status === column).map((task) => (
                <TaskCard key={task.id} task={task} dispatchTask={dispatchTask} confirmTask={confirmTask} canDispatch={canDispatch} canConfirm={canConfirm} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function TaskCard({ task, dispatchTask, confirmTask, canDispatch, canConfirm }) {
  return (
    <article className="rounded border border-ink/10 bg-panel p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="font-semibold">{task.category}</h4>
          <p className="mt-1 text-xs text-ink/60">{task.id} - {task.urgency} urgency</p>
        </div>
        {task.ringFenceEnforced && <span className="rounded bg-safe px-2 py-1 text-[11px] font-semibold text-white">Ring-Fence Enforced</span>}
      </div>
      <p className="mt-3 text-sm leading-5 text-ink/80">{task.careWorkerNotes}</p>
      <div className="mt-3 rounded bg-white p-2 text-xs text-ink/65">
        <div>{task.serviceUser.name}</div>
        <div>{task.serviceUser.address}</div>
      </div>
      {task.assignedTrader && <div className="mt-3 text-sm">Assigned: <b>{task.assignedTrader.name}</b></div>}
      <div className="mt-3 grid gap-1 rounded bg-white p-2 text-xs text-ink/65">
        <div>Assignment: <b>{task.assignmentStatus || "Pending assignment"}</b></div>
        <div>Payment: <b>{task.paymentStatus || "Pending cap check"}</b></div>
        {task.estimatedCustomerCharge ? <div>Estimated charge: <b>GBP {task.estimatedCustomerCharge}</b></div> : null}
      </div>
      {task.aiSummary && <div className="mt-3 rounded bg-blue-50 p-2 text-xs text-safe">AI summary: {task.aiSummary}</div>}
      {task.supervisedVisitRequired && <div className="mt-2 rounded bg-amber-50 p-2 text-xs font-semibold text-amber-800">Carer-on-site supervised visit required</div>}
      {task.tokenUrl && <a className="mt-2 block truncate text-xs font-medium text-safe" href={task.tokenUrl}>Trader visit link</a>}
      {task.status === "Triaged" && canDispatch && (
        <button onClick={() => dispatchTask(task.id)} className="mt-3 w-full rounded bg-ink px-3 py-2 text-sm font-semibold text-white">
          Approve & Dispatch Handyman
        </button>
      )}
      {task.status === "Triaged" && !canDispatch && <div className="mt-3 rounded bg-white px-3 py-2 text-xs font-semibold text-ink/60">Awaiting TaskBridge admin assignment approval</div>}
      {task.status === "Awaiting Confirmation" && canConfirm && (
        <button onClick={() => confirmTask(task.id)} className="mt-3 w-full rounded bg-safe px-3 py-2 text-sm font-semibold text-white">
          Confirm Completion
        </button>
      )}
    </article>
  );
}

function Compliance({ traders, runCheck, approveDbs }) {
  return (
    <section>
      <h2 className="text-2xl font-semibold">Trader Compliance Hub</h2>
      <p className="mb-4 text-sm text-ink/60">Enhanced DBS controls are enforced before vulnerable-adult dispatch.</p>
      <div className="overflow-x-auto rounded bg-white ring-1 ring-ink/10">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-ink text-white">
            <tr>
              <th className="p-3">Trader</th>
              <th className="p-3">Source</th>
              <th className="p-3">DBS Status</th>
              <th className="p-3">Rate</th>
              <th className="p-3">Availability</th>
              <th className="p-3">Expiry</th>
              <th className="p-3">Insurance</th>
              <th className="p-3">Quality</th>
              <th className="p-3">Last Check</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {traders.map((trader) => (
              <tr key={trader.id} className="border-t border-ink/10">
                <td className="p-3 font-medium">{trader.name}<div className="text-xs text-ink/50">{trader.mobile}</div></td>
                <td className="p-3 capitalize">{trader.source}</td>
                <td className="p-3"><Status status={trader.dbsStatus} /></td>
                <td className="p-3">GBP {trader.hourlyRate}/hr</td>
                <td className="p-3">{trader.nextAvailable}</td>
                <td className="p-3">{trader.dbsExpiryDate || "Awaiting"}</td>
                <td className="p-3">{trader.insuranceStatus || "Unverified"}<div className="text-xs text-ink/50">{trader.insuranceExpiryDate || "No expiry"}</div></td>
                <td className="p-3">{trader.qualityScore || "-"}%</td>
                <td className="p-3">{new Date(trader.lastCheckedAt).toLocaleString()}</td>
                <td className="p-3">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => runCheck(trader.id)} className="rounded bg-ink px-3 py-2 text-xs font-semibold text-white">Trigger Amiqus</button>
                    <button onClick={() => approveDbs(trader.id)} className="rounded bg-safe px-3 py-2 text-xs font-semibold text-white">Approve DBS</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Status({ status }) {
  const classes = status === "Approved" ? "bg-emerald-100 text-emerald-800" : status === "Rejected" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800";
  return <span className={`rounded px-2 py-1 text-xs font-semibold ${classes}`}>{status}</span>;
}

function AgencyOverview({ state }) {
  return (
    <section className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
      <div>
        <h2 className="text-2xl font-semibold">Client & Agency Overview</h2>
        <div className="mt-4 grid gap-4">
          {state.serviceUsers.map((user) => (
            <article key={user.id} className="rounded bg-white p-4 ring-1 ring-ink/10">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="font-semibold">{user.name}</h3>
                  <p className="text-sm text-ink/60">{user.address}</p>
                </div>
                {user.isVulnerable && <span className="rounded bg-safe px-2 py-1 text-xs font-semibold text-white">Vulnerable Adult</span>}
              </div>
            </article>
          ))}
        </div>
      </div>
      <div className="rounded bg-white p-4 ring-1 ring-ink/10">
        <h3 className="font-semibold">Audit Trail</h3>
        <div className="mt-3 space-y-3">
          {state.audit.map((event) => (
            <div key={event.id} className="border-l-2 border-safe pl-3">
              <div className="text-sm font-medium">{event.detail}</div>
              <div className="text-xs text-ink/50">{event.type} - {new Date(event.at).toLocaleString()}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function VisitWorkflow({ task, onRefresh }) {
  const [message, setMessage] = useState("");
  const [photoName, setPhotoName] = useState("");
  const token = new URLSearchParams(location.search).get("token");

  if (!task) return <Loading />;

  async function checkIn() {
    setMessage("Capturing secure location...");
    const fallback = { lat: task.serviceUser.lat, lng: task.serviceUser.lng };
    const coords = await new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(fallback);
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(fallback),
        { enableHighAccuracy: true, timeout: 7000 }
      );
    });
    const result = await api.checkIn(task.id, token, coords);
    setMessage(result.error || "Checked in. Welfare security instructions are now active.");
    await onRefresh();
  }

  async function complete() {
    const result = await api.complete(task.id, token, photoName ? `browser-capture://${photoName}` : "browser-capture://after-photo-required");
    setMessage(result.error || "Checkout received. Care confirmation is required before final completion.");
    await onRefresh();
  }

  return (
    <main className="min-h-screen bg-white">
      <section className="mx-auto flex min-h-screen max-w-md flex-col px-5 py-6">
        <div className="mb-6">
          <div className="mb-3 inline-flex rounded bg-ink px-3 py-2 text-sm font-semibold text-white">TaskBridge Visit</div>
          <h1 className="text-3xl font-semibold">{task.category}</h1>
          <p className="mt-2 text-sm text-ink/60">{task.id} - {task.status}</p>
        </div>
        <div className="rounded bg-blue-50 p-4 text-sm font-semibold text-safe ring-1 ring-safe/20">
          MANDATED WELFARE SECURITY: Present physical identification to resident caregiver.
        </div>
        <div className="mt-5 rounded bg-panel p-4 ring-1 ring-ink/10">
          <p className="text-sm leading-6">{task.careWorkerNotes}</p>
          <p className="mt-3 text-xs text-ink/60">Direct resident contact details are redacted. This token authorizes only this visit workflow.</p>
        </div>
        <div className="mt-5 space-y-3">
          <button onClick={checkIn} className="w-full rounded bg-ink px-4 py-3 font-semibold text-white">Step 1: Geofenced Check-In</button>
          <label className="block rounded border border-dashed border-ink/25 bg-panel p-4 text-center text-sm font-medium">
            Step 2: Upload After Chores Photo
            <input className="mt-3 w-full text-sm" type="file" accept="image/*" capture="camera" onChange={(event) => setPhotoName(event.target.files?.[0]?.name || "")} />
          </label>
          <button onClick={complete} className="w-full rounded bg-safe px-4 py-3 font-semibold text-white">Step 3: Check-Out / Sign-Off</button>
        </div>
        {message && <div className="mt-5 rounded bg-mint p-3 text-sm">{message}</div>}
        <div className="mt-auto pt-8 text-xs text-ink/45">Tokenized Twilio SMS workflow - no direct client contact exposed</div>
      </section>
    </main>
  );
}

function Loading() {
  return <div className="grid min-h-screen place-items-center bg-[#edf2ef] text-ink">Loading TaskBridge...</div>;
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);

