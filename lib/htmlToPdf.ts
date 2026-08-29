// Renders HTML to a real, print-engine-accurate PDF via headless
// Chromium (Aug 2026 — replaced a hand-drawn pdf-lib version on
// request: "I want the pdf to be exactly the docx literally just as a
// pdf"). See lib/meetingMinutesHtml.ts for how the HTML itself gets
// built (mammoth.js converts the real generated .docx to HTML, which
// this then prints).
//
// Two Chromium sources, picked at runtime:
//  - On Vercel/Lambda (`VERCEL` or `AWS_LAMBDA_FUNCTION_NAME` set):
//    @sparticuz/chromium's bundled Linux binary, the standard pairing
//    for puppeteer-core in a serverless function. This is a genuinely
//    large dependency (~50-80MB) and real render time (a second or two
//    per PDF) — worth confirming it fits your Vercel plan's function
//    size/duration limits; if it doesn't, that's the tradeoff called
//    out when this approach was chosen over a third-party conversion
//    API or dropping the PDF button.
//  - Locally: a real installed Chrome/Chromium. Defaults to macOS's
//    standard Chrome install path; override with PUPPETEER_EXECUTABLE_PATH
//    in .env if that's wrong for this machine (e.g. Linux dev, or
//    Chromium instead of Chrome).
import type { Browser } from "puppeteer-core";

const DEFAULT_LOCAL_CHROME_PATHS = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
];

async function launchBrowser(): Promise<Browser> {
  const puppeteer = await import("puppeteer-core");
  const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

  if (isServerless) {
    const chromium = (await import("@sparticuz/chromium")).default;
    return puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }

  const fs = await import("node:fs");
  const executablePath =
    process.env.PUPPETEER_EXECUTABLE_PATH ?? DEFAULT_LOCAL_CHROME_PATHS.find((p) => fs.existsSync(p));
  if (!executablePath) {
    throw new Error(
      "No local Chrome/Chromium found for PDF export. Set PUPPETEER_EXECUTABLE_PATH in .env to your browser's executable path."
    );
  }
  return puppeteer.launch({ executablePath, headless: true });
}

export async function renderHtmlToPdf(html: string): Promise<Uint8Array> {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    const pdf = await page.pdf({
      format: "letter",
      printBackground: true,
      margin: { top: "0.4in", bottom: "0.4in", left: "0in", right: "0in" }, // the HTML's own body padding sets the real margins — see lib/meetingMinutesHtml.ts
    });
    return pdf;
  } finally {
    await browser.close();
  }
}
