import config from "@payload-config";
import { getPayload, type Payload } from "payload";

export function getTestPayload(): Promise<Payload> {
  return getPayload({ config });
}
