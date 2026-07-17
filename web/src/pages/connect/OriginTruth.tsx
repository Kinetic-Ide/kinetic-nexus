import { ShieldCheck, Pin, TriangleAlert } from 'lucide-preact';
import type { GatewayConfig } from '../../api';
import s from '../pages.module.css';

// Public URL truth (P7.14). The gateway cannot observe TLS it did not terminate, so its idea of
// its own address is an inference — and a proxy that omits X-Forwarded-Proto makes it print
// `http://` with total confidence. This dashboard, though, is served same-origin: the browser's
// address bar PROVABLY reached the gateway, scheme and all. So the page compares the two and:
//
//   agree                → say so, quietly, naming the authority that spoke
//   pinned + disagree    → the pin wins (an operator on a VPN/internal address is normal),
//                          but say what happened
//   inferred + disagree  → the browser wins for everything copyable on this page — it is the
//                          only witness that cannot be lying — and the panel explains the two
//                          permanent fixes (PUBLIC_URL, or the proxy sending X-Forwarded-Proto)

export interface OriginVerdict {
  /** The origin every copyable value on the page should use. */
  origin: string;
  agrees: boolean;
}

const SOURCE_LABEL: Record<GatewayConfig['baseUrlSource'], string> = {
  env:   'pinned by PUBLIC_URL',
  proxy: 'reported by your reverse proxy',
  host:  'inferred from the request',
};

/** Decide which origin the page trusts. Pure — the component below renders the verdict. */
export function judgeOrigin(serverOrigin: string, source: GatewayConfig['baseUrlSource'], browserOrigin: string): OriginVerdict {
  const agrees = serverOrigin === browserOrigin;
  // A pin is the operator's explicit word and outranks where this particular browser happens to
  // sit; an inference that the address bar contradicts is simply wrong, and the browser wins.
  return { origin: agrees || source === 'env' ? serverOrigin : browserOrigin, agrees };
}

export function OriginTruth({ serverOrigin, source, browserOrigin }: {
  serverOrigin: string;
  source: GatewayConfig['baseUrlSource'];
  browserOrigin: string;
}) {
  const { agrees } = judgeOrigin(serverOrigin, source, browserOrigin);

  if (agrees) {
    return (
      <div class={s.originOk} role="status">
        <ShieldCheck size={14} />
        <span><b>Address verified</b> — matches this browser’s address bar · {SOURCE_LABEL[source]}</span>
      </div>
    );
  }

  if (source === 'env') {
    return (
      <div class={s.originPinned} role="status">
        <Pin size={14} />
        <span>
          <b>Pinned by PUBLIC_URL.</b> You’re browsing from <code>{browserOrigin}</code>, but the
          pinned address above is what clients should use — that is what a pin is for.
        </span>
      </div>
    );
  }

  return (
    <div class={s.originWarn} role="alert">
      <TriangleAlert size={15} />
      <div>
        <b>The gateway’s guess disagrees with your address bar.</b>
        <p>
          It believes it lives at <code>{serverOrigin}</code> ({SOURCE_LABEL[source]}), but this very
          page provably loaded from <code>{browserOrigin}</code> — so everything copyable here uses
          your browser’s address, the one witness that cannot be wrong about the scheme.
        </p>
        <p>
          To fix it permanently: set <code>PUBLIC_URL</code> in the server’s environment, or
          configure the proxy to send <code>X-Forwarded-Proto</code> and <code>X-Forwarded-Host</code>.
        </p>
      </div>
    </div>
  );
}
