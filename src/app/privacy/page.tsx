import type { Metadata } from "next";
import { Contact, LegalPage } from "@/components/legal";

export const metadata: Metadata = { title: "Privacy Policy · Ballot Helper" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        Ballot Helper is built to need as little of your information as possible. There are no accounts, no ads, and no
        analytics or advertising trackers, and we don&apos;t sell or share personal information.
      </p>

      <h2>What stays on your device</h2>
      <p>
        Your ballot, your picks, research results, and preferences are stored in your browser (local storage), and the
        file you upload is kept in your browser&apos;s IndexedDB so you can fill it in later. We don&apos;t receive your
        picks unless you choose to include them in a share link. To delete this data, use &ldquo;Clear&rdquo; on the home
        page or clear this site&apos;s data in your browser.
      </p>

      <h2>What we process on our servers</h2>
      <ul>
        <li>
          <strong>Your uploaded ballot</strong> is sent to our server and to Anthropic only to read the contests on it.
          We don&apos;t keep the file.
        </li>
        <li>
          <strong>Your address</strong>, if you look up your ballot by address, is sent to our server and to Google&apos;s
          Civic Information API only to find your sample ballot. We don&apos;t keep it.
        </li>
        <li>
          <strong>Research requests</strong> contain candidate and measure names, offices, and your ballot&apos;s
          election and jurisdiction. Finished research is about public candidates and measures, not about you, and is
          cached for up to 30 days so other voters with the same races don&apos;t trigger it again.
        </li>
        <li>
          <strong>Share links</strong> you create store the ballot&apos;s contests, research, and (only if you opt in) your
          picks, until you ask us to delete them.
        </li>
        <li>
          <strong>Abuse prevention:</strong> to enforce rate limits and spending caps, we process your IP address and a
          random device ID your browser creates. They&apos;re stored only as salted hashes in short-lived counters (hours to
          days), never alongside your ballot.
        </li>
        <li>
          <strong>Server logs:</strong> our host keeps standard request logs (which include IP addresses) for a limited
          time for security and debugging.
        </li>
      </ul>

      <h2>Service providers</h2>
      <ul>
        <li>
          <strong>Anthropic</strong> (Claude AI) reads ballots and generates research. Under Anthropic&apos;s commercial
          terms, data sent through its API isn&apos;t used to train its models.
        </li>
        <li>
          <strong>Google</strong> (Civic Information API) returns the sample ballot for an address you look up.
          Google&apos;s privacy policy applies to that request.
        </li>
        <li>
          <strong>Vercel</strong> hosts the site and stores the research cache and share links.
        </li>
        <li>
          <strong>Upstash</strong> (if enabled) stores the hashed rate-limit counters.
        </li>
        <li>
          <strong>Stripe</strong> processes contributions if you choose to chip in. Payments happen on Stripe&apos;s pages.
          We never see your full card details, and Stripe&apos;s privacy policy applies to what you enter there.
        </li>
      </ul>

      <h2>Children</h2>
      <p>The service is meant for voters and isn&apos;t directed to children under 13.</p>

      <h2>Your choices and rights</h2>
      <p>
        You can use the service without giving us your name or email. To ask about, or request deletion of, a share link
        or anything else we hold, contact <Contact />. Depending on where you live, you may have additional rights under
        local privacy laws, and we&apos;ll honor valid requests.
      </p>

      <h2>Changes</h2>
      <p>We may update this policy. The date at the top shows the latest version.</p>

      <h2>Contact</h2>
      <p>
        <Contact />
      </p>
    </LegalPage>
  );
}
