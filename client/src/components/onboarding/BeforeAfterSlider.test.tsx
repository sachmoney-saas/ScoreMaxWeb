import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BeforeAfterSlider } from "./BeforeAfterSlider";

describe("BeforeAfterSlider", () => {
  it("renders the generated after image as the revealed overlay", () => {
    const html = renderToStaticMarkup(
      <BeforeAfterSlider
        language="fr"
        beforeSrc="before.jpg"
        afterSrc="after.jpg"
      />,
    );

    const beforeIndex = html.indexOf('src="before.jpg"');
    const afterIndex = html.indexOf('src="after.jpg"');

    expect(beforeIndex).toBeGreaterThanOrEqual(0);
    expect(afterIndex).toBeGreaterThan(beforeIndex);
    expect(html).toContain("clip-path:inset(0 0 0 50%)");
  });
});
