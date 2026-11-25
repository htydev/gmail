import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

test("thread displays each message's own Gmail labels, not the thread's combined status", () => {
	const messages = [
		{ id: "sent-message", labelIds: ["SENT"] },
		{ id: "draft-message", labelIds: ["DRAFT"] },
		{ id: "received-message", labelIds: ["INBOX", "UNREAD"] },
		{ id: "unlabelled-message" },
	].map((message) => ({
		...message,
		parsed: {
			headers: { from: "sender@example.com", to: "recipient@example.com", date: "2026-11-24", subject: "Same subject" },
			body: "Same body",
			attachments: [],
		},
	}));
	// Isolate the CLI's argv and service stub from the other service tests.
	const result = Bun.spawnSync([process.execPath, "-e", `
		import { spyOn } from "bun:test";
		import { GmailService } from "./src/gmail-service.ts";
		spyOn(GmailService.prototype, "getThread").mockResolvedValue({ messages: ${JSON.stringify(messages)} });
		process.argv = ["bun", "cli.ts", "--account", "reader@example.com", "thread", "test-thread"];
		await import("./src/cli.ts");
	`], {
		cwd: fileURLToPath(new URL("..", import.meta.url)),
		env: { PATH: process.env.PATH ?? "" },
	});
	expect(result.stderr.toString()).toBe("");
	expect(result.exitCode).toBe(0);
	const blocks = result.stdout.toString().split("\n---\n");
	for (const [index, labels] of ["SENT", "DRAFT", "INBOX,UNREAD", "(none)"].entries()) {
		expect(blocks[index]).toContain(`Message-ID: ${messages[index].id}\nLabels: ${labels}\n`);
	}
	expect(blocks[0]).not.toContain("DRAFT");
	expect(blocks[1]).not.toContain("SENT");
});
