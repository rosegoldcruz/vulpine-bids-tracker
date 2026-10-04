const db = require('../db');

// Verified against cruz@vulpine.llc Sent mail on 2026-09-20. These are the
// contractor-facing messages whose attached proposal matches the tracker PDF.
const matches = [
  [134,'2026-08-06','11:15:45','Davis','danderton@brsystems.com','102 Maple Townhomes Project - Vulpine Cabinet Bid','19fd849e818232ad'],
  [135,'2026-07-20','00:03:47','Elena','ewimberly@catamountinc.com','162 Ashley Ave Cabinet Quote - Vulpine, LLC','19f7e56855bc272f'],
  [136,'2026-07-31','21:55:07','Greg','gkohler@vccusa.com','966 B Street Apartment Project – Vulpine Cabinet Proposal','19fbbad0c6faaaf4'],
  [137,'2026-07-07','10:58:37','Nathan, Brent & Estimating Team','altavista@thegarrettco.com','Alta Vista | Centennial, Colorado – 446 Units - ITB','19f3dbb5ee27dd14'],
  [138,'2026-08-17','04:11:52',null,'joel.carr@owow.com','Arete Island Project - Vulpine Casework Bid','1a00f6bb8c6ac81d'],
  [140,'2026-09-02','03:39:33','Eric','emendoza@consolidatedcontracting.com','E Street Apartments Cabinets Quote | Vulpine','1a061b3e3da6fdcf'],
  [141,'2026-07-17','14:54:42','James','james@haggertybuilds.com','Edison House casework and cabinet quote - Vulpine','19f72131fbe6ec3a'],
  [142,'2026-08-01','13:42:57',null,'lyanacheak@koestercon.com, jgasperi@koestercon.com','Garden at Mountains Project – Vulpine Cabinet Proposal','19fbf10cc0314959'],
  [143,'2026-08-11','00:01:13',null,'akeener@douglascompany.com','Green Oaks on Crossleigh Court Apartment Project - VULPINE','19fefa0178b3a54c'],
  [144,'2026-08-21','12:21:57','Andrew','abarger@douglascompany.com','Green Oaks of Hamilton Township - Vulpine Casework Bid','1a025c5d97792735'],
  [145,'2026-08-04','00:28:57','Andrew','abarger@douglascompany.com','Green Oaks of Lima – Cabinet Proposal','19fcbacf979c413f'],
  [146,'2026-07-18','02:14:14','Nathan','Nsharpe@harkinsbuilders.com','Holly Place Cabinet Supply Quote','19f74813fc9a3012'],
  [147,'2026-08-17','05:26:50',null,'jeffm@themcpgroup.com','The Hutch Project at The MCP Group - Vulpine Casework Bid','1a00fb05b507d9a1'],
  [148,'2026-08-17','06:48:58',null,'scottn@stoutestimating.com','Indie Apartments | Stout Construction - Vulpine Casework Bid','1a00ffb8d7603f3d'],
  [149,'2026-07-28','11:13:18','Estimating Team; Tina Quaintance','estimating@tri-stategc.com, tquaintance@tri-stategc.com','Iron Wolf Apartments – Standard & Premium Cabinet - Vulpine','19fa9ee5bcb929a7'],
  [150,'2026-08-06','10:49:52',null,'danderson@ronco-construction.com, dparr@ronco-construction.com','Lusso Apartments – Vulpine Quote Submission','19fd832250babec4'],
  [151,'2026-08-29','15:40:27','Linda','lstache@gormanusa.com','Midtown Commons – Cabinet Supply Proposals – Vulpine','1a04fae729c94744'],
  [152,'2026-09-03','17:03:51','Nick','nicke@tbpenick.com','Oceangate – Cabinet Supply + Installation Proposal | Vulpine','1a069ba9751971e6'],
  [153,'2026-09-01','13:13:53','Linda Stache','lstache@gormanusa.com','Orange on 14th Street','1a05e9b8e978afcc'],
  [154,'2026-07-30','02:14:14','Azita','abadri@vccusa.com','Park Place Apartments – Cabinet Proposal - VULPINE','19fb24d8beafcc0d'],
  [155,'2026-07-13','22:52:38','Jose','jose@nearcal.com','Park 25 Casework Bid - Vulpine','19f5f2f3b9523207'],
  [156,'2026-08-17','04:30:13',null,'bryan@pimmexcontracting.com','PARKER HOUSING PROJECT - Vulpine Casework Bid','1a00f7c84484f805'],
  [157,'2026-07-25','21:23:11','David','david@kier.org','PCHA Mountain View & PCHA Valley Villa – Vulpine Cabinet Proposals','19f9ca9a5399ef37'],
  [158,'2026-07-25','21:23:11','David','david@kier.org','PCHA Mountain View & PCHA Valley Villa – Vulpine Cabinet Proposals','19f9ca9a5399ef37'],
  [159,'2026-07-14','00:36:11',null,'bjamaro@pcl.com','Petroleum Building Cabinet Bid | Vulpine','19f5f8e04c172ed5'],
  [160,'2026-07-14','05:23:10','Andrew & Estimating Team','andrewp@stoutestimating.com, jerrieh@stoutestimating.com','Vulpine Casework Bid | Powder Mountain Townhomes','19f6094c53b91923'],
  [161,'2026-08-31','05:12:29','Optima Team','danb@theprimecompany.com','Invitation to Bid: Prime @ Lakewood Apartments - 405 Units - Lakewood, CO','1a057bc40d85544d'],
  [162,'2026-08-31','12:50:38','Jacob Lundquist','jake.lundquist@charteredcompanies.com','Re: RANCHWOOD AT ERIE TOWN CENTER Project Proposal - Vulpine Casework Bid','1a0595fb1f32f215'],
  [163,'2026-08-10','22:45:59',null,'estimating@dempseyconstruction.com','Cabinet & Casework Bid Submission | Vulpine - Room Renovation Quote','19fef5b3207f077c'],
  [164,'2026-06-25','23:36:33','Andrew','asokol@douglascompany.com','Silver Birch of Zanesville - Vulpine Cabinet & Casework Supply Quote','19f02a4f70bbcef6'],
  [165,'2026-08-13','13:31:57','Andrew Sokol','asokol@douglascompany.com','Re: Silver Birch of Euclid – Cabinet Supply Proposal - Vulpine','19ffcd310b8d7e55'],
  [166,'2026-07-29','23:34:49','Andrew','asokol@douglascompany.com','Silver Birch of Painesville – Cabinet Bid - VULPINE','19fb1bb9a1d8acce'],
  [167,'2026-08-21','12:48:46',null,'j.sanora@sonoranpueblo.com','iHouse – Units Only | Vulpine Cabinet Bid','1a025de64b4c96af'],
  [168,'2026-07-31','14:13:01','Estimating Team','sugarcreek@thegarrettco.com','Sugar Creek Cabinet Proposal - Vulpine','19fba05f8b73e93f'],
  [169,'2026-07-27','13:36:00','Brian','bbailey@modelgroup.net','(No Subject)','19fa54aa9503c3ab'],
  [170,'2026-06-12','16:16:00','Jose and Team','jose@nearcal.com','Cabinet Supply Quote','19fc9250b214ff4c'],
  [171,'2026-07-14','11:06:41','Brian and Team','stgbids@bonnevillebuilders.com','The Enclave - Cabinet Supply and Installation Proposal','19f61cf4326b0796'],
  [172,'2026-09-01','22:15:24','Prime Built Team','andyk@theprimecompany.com','The Greens at Grandview – Cabinet Supply Proposal','1a0608b1d5f6f379'],
  [173,'2026-09-03','17:23:32','Azita Badri; Jose Garcia','abadri@vccusa.com, jgarcia@vccusa.com','Re: The Park Multifamily – Cabinet Supply Proposal – Vulpine','1a069cc9fca21954'],
  [174,'2026-07-29','16:50:27','Chris Dobrovolny','chrisd@sub4development.com, chrisd@sub4dev.com','306 South 2nd Project — Trim Package - White Shaker Bid','19fb04964695e4df'],
  [175,'2026-07-29','16:26:37','Chris Dobrovolny','chrisd@sub4development.com, chrisd@sub4dev.com','The Crossing Lot 104 — Revised White Shaker Bid - VULPINE','19fb0339443b1d35'],
  [176,'2026-08-14','01:34:55','Linda Stache','lstache@gormanusa.com','Invitation To Bid - West 11th Apartments - VULPINE','19fff692b3f2973c']
];

const unresolved = [
  [178,'Issaquah PDF only appears in internal messages to Mike Musonda.']
];

const update = db.prepare(`
  UPDATE bids SET sent_date = ?, sent_time = ?, sent_timezone = 'MST',
    recipient_name = ?, recipient_email = ?, email_subject = ?,
    gmail_message_id = ?, email_match_status = 'verified'
  WHERE id = ?
`);
const clear = db.prepare(`
  UPDATE bids SET sent_date = NULL, sent_time = NULL, sent_timezone = NULL,
    recipient_name = NULL, recipient_email = NULL, email_subject = ?,
    gmail_message_id = NULL, email_match_status = 'unverified'
  WHERE id = ?
`);

db.transaction(() => {
  for (const [id,date,time,name,email,subject,messageId] of matches) {
    update.run(date,time,name,email,subject,messageId,id);
  }
  for (const [id,note] of unresolved) clear.run(note,id);
  db.prepare("UPDATE bids SET company_name = 'The Garrett Company' WHERE id = 137").run();
  db.prepare("UPDATE bids SET company_name = 'Harkins Builders' WHERE id = 146").run();
  db.prepare("UPDATE bids SET company_name = 'Kier Construction' WHERE id = 158").run();
})();

const counts = db.prepare(`SELECT email_match_status, COUNT(*) AS count FROM bids GROUP BY email_match_status`).all();
console.log(JSON.stringify(counts));
db.close();
