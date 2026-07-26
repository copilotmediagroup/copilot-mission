# RC3.1 Notification Engine Contract

## Authority
A notification is created once as a durable `notification_event`. Delivery is represented explicitly by `notification_recipients`; UI toasts, unread badges, and the Notification Center are projections of that record.

## Guarantees
- Realtime toast without refresh.
- Persistent unread notification after the toast disappears.
- Idempotent event keys prevent duplicate alerts.
- A claimed marketplace job is withdrawn from non-winning agencies.
- Presentation never queries marketplace tables to invent notification state.
- The engine is extensible to Guard, Client, Platform, push, email, and SMS subscribers.
