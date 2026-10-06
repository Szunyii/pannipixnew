import type { Access } from "payload";

/** Every account in this Payload is the studio's admin, so being logged in is the permission. */
export const isAdmin: Access = ({ req }) => Boolean(req.user);

export const anyone: Access = () => true;

/** Visitors only see designs switched on for the site; admins see everything. */
export const adminOrVisible: Access = ({ req }) => (req.user ? true : { visible: { equals: true } });
