import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { extractYouTubeVideoId, youTubeEmbedUrl, isValidYouTubeVideoId } from "../../src/youtube";

const ID = "dQw4w9WgXcQ";
describe("extractYouTubeVideoId", () => {
  test("accepts watch, short, shorts, embed, live and bare-domain links", () => {
    for (const u of [`https://www.youtube.com/watch?v=${ID}`, `https://youtu.be/${ID}`, `https://youtube.com/shorts/${ID}`, `https://www.youtube.com/embed/${ID}`, `https://www.youtube.com/live/${ID}`, `youtube.com/watch?v=${ID}&t=5`, `https://m.youtube.com/watch?v=${ID}`]) {
      assert.equal(extractYouTubeVideoId(u), ID, u);
    }
  });
  test("rejects other hosts, lookalikes, dangerous schemes and credentials", () => {
    for (const u of [`https://vimeo.com/${ID}`, `https://youtube.com.evil.com/watch?v=${ID}`, `https://evilyoutube.com/watch?v=${ID}`, `javascript:alert(1)`, `data:text/html,x`, `https://user:pw@www.youtube.com/watch?v=${ID}`, `ftp://youtube.com/watch?v=${ID}`]) {
      assert.equal(extractYouTubeVideoId(u), null, u);
    }
  });
  test("rejects malformed IDs, empty and oversized input", () => {
    assert.equal(extractYouTubeVideoId("https://youtu.be/short"), null);
    assert.equal(extractYouTubeVideoId("https://youtu.be/" + "a".repeat(40)), null);
    assert.equal(extractYouTubeVideoId(""), null);
    assert.equal(extractYouTubeVideoId(null), null);
    assert.equal(extractYouTubeVideoId("https://youtu.be/" + ID + "?" + "x".repeat(400)), null);
  });
  test("embed URL is the privacy-enhanced domain and refuses bad IDs", () => {
    assert.equal(youTubeEmbedUrl(ID), `https://www.youtube-nocookie.com/embed/${ID}?rel=0`);
    assert.throws(() => youTubeEmbedUrl('x" onload="alert(1)'));
    assert.ok(isValidYouTubeVideoId(ID) && !isValidYouTubeVideoId("nope"));
  });
});
