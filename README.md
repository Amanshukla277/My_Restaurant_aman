A small billing app for a restaurant. The staff picks a table, adds dishes to the order, and generates the bill. There is also a menu manager, bill history and a daily sales report.


- Backend: Node.js (v22.13 or newer) using only built-in modules (`http` and `node:sqlite`). No `npm install` is needed.
- Database:SQLite. The file `data/restaurant.db` is created automatically on the first run, with a sample menu and 8 tables.
- Frontend:plain HTML, CSS and JavaScript (no framework, no build step). The Node server serves it.
-Tests:Node's built-in test runner.


```
node -v        # should be 22.13 or newer
npm start      # open http://localhost:5000
npm test       # run the tests
```

To use another port: `PORT=3000 npm start` (on Windows PowerShell: `$env:PORT=3000; npm start`).
To start fresh, stop the server and delete the `data` folder.


- Billing screen: table grid (free or busy, with the running amount), takeaway orders, tap a dish to add it, category filter, search (Enter adds the first match), veg / non-veg mark, quantity + and -, remove a line, note for the kitchen.
- Discount:by percentage or a flat amount, totals update while typing.
- Table actions: move a running order to another free table, or cancel an order with a reason.
- Payment: cash (shows the change to return), UPI or card. Receipt can be printed.
- Menu manager: add, edit and delete categories and dishes, mark a dish as unavailable.
- Bills:history with date filter and search, open and print any old bill again.
- Daily report: sales, number of bills, average bill, discounts, GST, split by payment method and order type, top selling items, cancelled orders.
- Settings:restaurant name, address, GSTIN, GST %, service charge %, and the list of tables.


```
subtotal        = sum of all items
service charge  = service % of subtotal
GST             = GST % of (subtotal + service charge)
bill total      = subtotal + service charge + GST
discount        = % of bill total, or a flat amount
payable         = bill total - discount, rounded to the nearest rupee
```

Example: items Rs 480, GST 5% = Rs 24, bill total Rs 504. A 10% discount is Rs 50.40, so the amount is Rs 453.60 and the payable amount is **Rs 454** (round off +Rs 0.40).

All money is stored in **paise** (whole numbers), so there are no decimal problems like 0.1 + 0.2.


```
server.js        starts the server, serves the files, sends each /api request to a route
db.js            opens the database, creates the tables, adds the sample data
schema.sql       all CREATE TABLE statements
calc.js          the bill calculation
check.js         checks the values sent by the browser
queries.js       database lookups used by more than one route
routes/          menu, tables, orders, bills, reports, settings
public/          index.html, style.css and js/ (one file for each screen)
tests/           calc.test.js (bill maths), api.test.js (full API flow)
```


| Table | What it stores |
|-------|----------------|
| categories, menu_items | the menu |
| tables | restaurant tables and their seats |
| orders | one row per order (dine-in or takeaway) with status open / billed / cancelled |
| order_items | dishes in an order. Name and price are copied from the menu, so old bills do not change when the menu changes |
| bills | one bill per order, with every amount and rate saved |
| settings | restaurant name, address, GSTIN, GST % and service charge % |

Some decisions:

- A table can have only one open order. The database itself enforces this with a unique index.
- Deleted menu items, categories and tables are only hidden (`is_active = 0`), so old orders and bills still work.
- Generating a bill and closing the order happen in one transaction.
- The server calculates all amounts again when the bill is made. The browser only sends the discount, the payment method and the cash received.


- There is no login or user roles.
- Only one payment method per bill. There is no refund or split payment.
- Printing uses the browser print dialog, there is no thermal printer or kitchen ticket.
- `node:sqlite` is still marked experimental in Node, so a warning is hidden with `--no-warnings`.
- The frontend is tested by hand. Only the backend has automatic tests.
- Percentages are calculated with normal JavaScript numbers. This is fine for normal values, but a very unusual percentage 

- Staff login with roles (waiter, cashier, admin).
- Kitchen order tickets (KOT) with item status.
- Split payments and refunds.
- Item-wise GST rates.
- Stock / inventory tracking.
- Export reports to CSV or PDF.
- Thermal printer and UPI QR code on the bill.
# My_Restaurant_aman
