import { describe, expect, it } from "vitest";
import { administrators } from "./ranks";

/**
 * Who counts as an administrator, which is what the last-administrator
 * refusal is built on (Increment 1.78).
 */
describe("administrators", () => {
  const person = (id: string, role: string, active = true) => ({ id, role, active });

  it("counts an active administrator", () => {
    expect(administrators([person("a", "admin")])).toEqual(["a"]);
  });

  it("does not count somebody below that rank", () => {
    expect(administrators([person("a", "manager"), person("b", "lead"), person("c", "readonly")])).toEqual([]);
  });

  it("does not count an administrator who has left", () => {
    // A deactivated account cannot sign in, so counting it would let a
    // practice lower its last live administrator on the strength of somebody
    // who cannot act.
    expect(administrators([person("a", "admin", false)])).toEqual([]);
  });

  it("ignores a rank this product does not have rather than throwing on it", () => {
    expect(administrators([person("a", "superuser"), person("b", "admin")])).toEqual(["b"]);
  });

  it("returns every administrator, because the refusal turns on how many there are", () => {
    expect(administrators([person("a", "admin"), person("b", "admin"), person("c", "user")])).toEqual(["a", "b"]);
  });
});
