Approach Document for Customer Integrations
1.	Overview
This document outlines the integration approach for enabling data exchange between customers and the Department of Posts (DOP). The solution supports both inbound (customer to DOP) and outbound (DOP to customer) data flows for article booking and event updates through multiple channels, ensuring high availability, security, and scalability.
The integration framework is designed to work across Web Portal, SFTP, and API, with provisions for real-time event sharing, multi-format data support, and detailed operational analytics.
2.	Objective
To provide a seamless, secure, and scalable integration mechanism across three integration options: Web Portal, SFTP, and API, with role-based access, encryption, and automated validation that allows customers to:
	Submit article booking data
	Receive post-booking event updates
	Access comprehensive reports and analytics
3.	Scope
	Domestic and International (Commercial and Non-Commercial) article booking
	File and API-based data intake
	Automated event updates via XML (future support for JSON, CSV, TXT)
	Support for standard logistics fields and business requirements
	Reports and dashboards for operational and analytical insights
	API-based pin code validation, tariff lookup, booking, and tracking	
4.	Integration Channels (Inbound)
4.1.	Web Portal Upload
o	Secure MFA login provided to customers
o	Drag-and-drop Excel/CSV/XML upload interface with progress tracking
o	Real-time format validation; errors displayed in UI with downloadable error logs
o	Bulk upload support with historical upload logs
4.2.	 SFTP Upload
o	Unique credentials and segregated folder structure per customer
o	Supported formats: CSV, Excel, XML
o	Data is polled, validated, and booked automatically
o	Checksum verification to ensure file integrity
4.3.	API Integration
o	REST API with token authentication and IP whitelisting
o	Customers push booking data in real-time
o	API validates and books instantly, returning booking reference numbers
o	Sandbox environment for testing before go-live
5.	Data Structure for Booking (Inbound)
	Common Fields (Appended First in All Channels): Serial Number, Barcode No, Physical Weight, Receiver City, Receiver Pin code
	Domestic Booking Fields include Receiver Name, Address Lines, Ack, Sender & Receiver Contacts, Prepayment, Cod, Insurance, Shape, Dimensions, Priority Flag, Delivery Instructions, Sender & Receiver Kyc/Tax, Bulk Ref, etc.
	International Booking Fields include Commercial invoice details, customs declaration, HS code, item category, declared value, currency, and supporting documents (commercial/non-commercial).
Note: Additional fields for international commercial/non-commercial to be shared separately.
6.	Event File Sharing (Outbound)
	Mechanism:
o	Generated post-booking.
o	Shared in XML format via OUTBOUND SFTP folder.
o	Future: API endpoint and portal download in XML/JSON/CSV/TXT formats

	IB – Item Booked: Booking info + EventCode 'ITEM_BOOK'
	ID – Item Delivered: Delivery info + EventCode 'ITEM_DELIVERY'
	LE – Last Event: Last scanned event info for each article.
	RT – Returned: Return-to-sender data with <NonDelReason> included.
7.	Integration Security
	SFTP: Credential-based, encrypted transfer
	API: Token-based, HTTPS, whitelisted IPs
	Portal: MFA-secured login, access logs
	End-to-end encryption for sensitive fields (KYC, payment details)
8.	Customer ON boarding Process
8.1.	Sandbox Environment
To ensure smooth adoption and integration, a Sandbox Environment is provided for customers to test booking and event APIs before going live.
8.1.1 Key Features:
o	Isolated Environment: Mirrors production APIs with mock data and test endpoints.
o	Test Credentials: Customers are issued sandbox API keys and SFTP folders for testing.
o	Booking API Simulation: Customers can simulate article booking, validate request formats, and confirm system responses.
o	Event API Simulation: Customers can receive mock event files (IB, ID, LE, RT) and test their downstream systems.
o	Validation Feedback: Real-time validation logs are generated (errors, warnings, success) to help customers align their formats with production standards.
o	Performance Testing: Supports high-volume uploads to simulate bulk booking scenarios.
o	No Impact on Production: All transactions in sandbox are isolated and do not affect live data.
8.1.2   Usage in ON boarding:
o	After initial setup, customers are onboarded to the sandbox with credentials and documentation.
o	Customers perform trial uploads, API calls, and event consumption.
o	Validation results are reviewed jointly with the DOP integration team.
o	Upon successful testing, customers are promoted to the production environment by registering into the portal.
	Requirement analysis: channel preference, format, event needs
	Environment Setup: credentials, API keys, SFTP folder allocation
	Share documentation, API specs, and templates
	Test integration (UAT) with live validation logs
	Go-live with monitoring and escalation matrix
9.	Monitoring & Support
	Full audit logging for all uploads/downloads
	Validation logs & downloadable error files
	Real-time system health monitoring dashboard
	Dedicated support desk for issues, with SLA-based ticket resolution
10.	 Reports and Analytics
10.1	 Operational Reports 		
o	Booking Report
o	Delivery Report
o	Event Report
o	Returned Articles Report
10.2	 Analytical Reports 
o	Trend Analysis Report (time-based volume or SLA)
o	 Performance Analysis Report (office-wise, product-wise)
o	Customer Behaviour Report (usage patterns, success rates)
10.3	 Custom Reports   
o	 Report Builder for custom filters (date, service, PIN, etc.)
o	 Export options: PDF, Excel, CSV
o	 Scheduled reports to email
10.4	 Visual Dashboard
o	Graphs and charts to represent key analytics
o	 Booking trendline, delivery ratios, event timelines
o	 Custom widgets and filters for insights
11.	Backend & Architecture Overview
	API Gateway: Routing, load balancing, rate limiting, orchestration
	Database: PostgreSQL with indexed schemas, replication, backups
	SFTP Server: Segregated inbound/outbound directories, checksum validation
	Notification Module: Multi-channel alerts (email/SMS) with templates and tracking
12.	 Future Enhancements
	Enhanced dashboards with predictive analytics
13.	Technical Integration
13.1	Session API
13.1.1.	Access token API
This endpoint is used to authenticate users and obtain access tokens for subsequent API requests. By providing valid credentials, users can receive an access token, a refresh token, and an ID token, which are essential for maintaining a session and accessing protected resources.
	Request
	Method: POST
	 URL: https://app.indiapost.gov.in/beextcustomer/v1/access/login
	 Content-Type: application/json
	Request Body
The request body must be formatted as JSON and include the following parameters:
	username (string): The unique identifier for the user, typically a phone number or user ID.
	 password (string): The user's password for authentication.
{
"username": "1234567890", 
"password": "Dop@1234" 
}
	Note: Use the Customer Self-Service Portal credentials for token generation.
	Response
Upon successful authentication, the API will return a response with the following structure:
	Status Code: 200
	Content-Type: application/json
	Response Body
The response will contain the following fields:
	success (boolean): Indicates whether the login was successful.
	message (string): A message providing additional information (may
be empty).
	data (object): Contains the authentication tokens and their
expiration details.
	access_token (string): The token used to access protected
resources.
	refresh_token (string): The token used to obtain a new access
token when the current one expires.
	id_token (string): A token that contains user identity
information.
	expires_in (integer): The duration in seconds until the access
token expires.
	refresh_expires_in (integer): The duration in seconds until the
refresh token expires.
{
"success": true,
"message": "",
"data": {
"access_token": "",
"refresh_token": "",
"id_token": "",
"expires_in": 0,
"refresh_expires_in": 0
}
}
Note:
 	Ensure that the username and password are correctly formatted and valid to avoid authentication errors.
 	The tokens provided in the response should be securely stored and used for subsequent API requests that require authentication

13.1.2.	Token Refresh API
This endpoint is used to refresh the access token for a user session. It allows clients to obtain a new access token without requiring the user to re-authenticate, thereby improving the user experience by maintaining session continuity.
	Request
	Method: POST
	URL: https://app.indiapost.gov.in/beextcustomer/v1/access/TokenWithRtoken
	Authorization: Bearer token

	Request Body
Currently, no specific parameters are required in the request body. Only refresh token is required and should be sent as bearer token for authorization.
	Response Structure
Upon a successful request, the response will typically include the following:
	access_token: A new access token that can be used for
subsequent API calls.
	expires_in: The duration (in seconds) until the access token
expires.
	token_type: The type of token returned (usually "Bearer").
Example Response:
{
"success": true,
"message": "",
"data": {
"access_token": "",
"refresh_token": "",
"id_token": "",
"expires_in": 0,
"refresh_expires_in": 0
}
}

13.2	Tariff API
o	Tariff API for Speed Post, Business Parcel and International Mail services.
o	 This API Provides the Base Tariff and Tax based on the Chargeable weight, distance for Domestic Mail services and International Mail services.


13.2.1	International Tariff API
	Tariff  API for International Mail services such as Letters, Parcels, and EMS. It provides the base tariff and tax (if applicable) based on the weight, destination country, and optional services like registration and insurance.
	API Url:
https://app.indiapost.gov.in/beextcustomer/v1/international-tariff/calculate?product-code=FGN_LETTER&weight=50&country-code=US&registration=true&insurance=true&ins-amount=5000
	Authorization: Bearer token
	 Sample Input and Output:
 Sample Input:
Parameter	Value
product-code	FGN_LETTER
weight	50
country-code	US
registration	true
insurance	true
ins-amount	5000








Sample Output:
{
  "chargeable_weight": 50,
  "country": "United States of America",
  "price": 150,
  "registration_charge": 120,
  "insurance_charge": 50,
  "base_tariff": 320,
  "igst": 0,
  "cgst": 0,
  "sgst": 0,
  "gst": 0,
  "total_with_tax": 320,
  "success": true
}
	The price refers to the standard tariff calculated based on weight and distance, whereas the base tariff includes this price along with additional charges for value-added services.
	If valid Input: Status in response will be “success”:true with required details.
	 Incase Invalid, following errors will be available in response at success:false  with error code and message
	The item should meet India post parcel conditions
	Source Pincode to be correct 
	Destination Pincode  to  be correct.
	Dimension should not  exceed max allowed value.
	Tariff depends on destination country and slab weight.
	Registration and insurance are optional add-ons.
	Insurance amount is restricted to limits prescribed by India Post.
	Valid Dimensions are Length(14cms - 150cms), Breadth(9cms - 150cms), Height(1cms - 150cms) and Sum of Length and two times of Width and Height should not exceed 300 cms
	Enter proper weight (if the weight zero or a negative value).The weight (Actual weight or Volumetric Weight whichever is Max) on which the tariff is calculated.
	In case of invalid input, response will include success:false with error code and message.
	The base price applicable on the Chargeable weight and Distance. 
	Tax(CGST & SGST) applicable on the base Tariff. If GSTIN is provided then tax is charged under igst.
13.2.2	Parcel Tariff API

	Provides tariff calculation for domestic parcel services, including COD (Cash on Delivery) and insurance charges.
	APIUrl:
https://app.indiapost.gov.in/beextcustomer/v1/parcel-tariff/calculate? product-code=PARCEL&weight=1500&source-pincode=400001 &destination-pincode=700001&length=30&width=20&height=15& cod=true&cod-amount=2000&insurance=true&ins-amount=5000
	 Authorization: Bearer token
	 Sample Input and Output:
Sample Input:
Parameter	Value
product-code	PARCEL
weight	1500
source-pincode	400001
destination-pincode	700001
length	30
width	20
height	15
cod	true
cod-amount	2000
insurance	true
ins-amount	5000
Sample Output:
{
  "chargeable_weight": 1500,
  "volumetric_weight": 1800,
  "price": 120,
  "distance": 2025,
  "cod_charge": 50,
  "insurance_charge": 30,
  "base_tariff": 200,
  "cgst": 9,
  "sgst": 9,
  "igst": 0,
  "gst": 18,
  "total_with_tax": 236,
  "success": true
}

	Tariff is calculated on max(weight, volumetric weight).
	COD charges depend on COD amount.
	Insurance charges depend on insured value.
	Dimension restrictions same as Speed Post Parcel (L, B, H not exceeding limits).



13.2.3	Letter Tariff API
	Tariff calculation for registered domestic letters, with optional acknowledgement (AD) and insurance.
	APIUrl:
https://app.indiapost.gov.in/beextcustomer/v1/letter-tariff/calculate? product-code=LETTER &weight=150&source-pincode=400001& destination-pincode=110001&reg=true&ack=true&ins=true&ins-amount=5000

	 Authorization: Bearer token
	 Sample Input and Output:
Sample Input:
Parameter	Value
product-code	LETTER
weight	150
source-pincode	400001
destination-pincode	110001
reg	true
ack	true
ins	true
ins-amount	5000
Sample Output:
{
  "chargeable_weight": 150,
  "price": 35,
  "registration_charge": 20,
  "ack_charge": 5,
  "insurance_charge": 25,
  "base_tariff": 85,
  "cgst": 4,
  "sgst": 4,
  "igst": 0,
  "gst": 8,
  "total_with_tax": 93,
  "success": true
}
	Registration (reg) is mandatory for insurance.
	Acknowledgement Due (AD) adds additional charges.
	Insurance restricted to prescribed limits.

13.2.4	Speed Post Tariff API
	Provides tariff calculation for Speed Post articles, including insurance (INS) and Proof of Delivery (POD).
	APIUrl:
https://app.indiapost.gov.in/beextcustomer/v1/speed-post/tariffs? product-code=SP&weight=250&source-pincode=400001& destination-pincode=110001&length=30width=21&height=0.5 &INS=1000 &POD=YES
	Authorization: Bearer token
	 Sample Input and Output:
Sample Input:
Parameter	Value
product-code	SP
weight	250
source-pincode	400001
destination-pincode	110001
length	30
width	21
height	0.5
INS	1000
POD	YES


Sample Output:
{
  "chargeable_weight": 250,
  "volumetric_weight": 300,
  "distance": 1450,
  "price": 40,
  "insurance_charge": 10,
  "pod_charge": 5,
  "base_tariff": 55,
  "cgst": 3,
  "sgst": 3,
  "igst": 0,
  "gst": 6,
  "total_with_tax": 61,
  "success": true
}
	Tariff is based on higher of actual or volumetric weight.
	POD (Proof of Delivery) adds additional charge.
	Insurance applicable only if declared (INS).
	Same dimensional restrictions as Speed Post Parcel.
13.3	Pin Code Search API
o	This API validates any PINCODE and provides Post office Details and also can be used to search offices under a given pincode number.
o	APIUrl:https://app.indiapost.gov.in/bemasterdata/v1/offices/limited-details?pincode=570001&limit=50&office-type=post
o	Authorization: Bearer token
o	Sample Input and Output:
Sample Input:
Parameter	Value
pincode	570001
office-type	post
Sample Output:
[
        {
            "pincode": 570001,
            "office_name": "Krishna Rajendra Circle S.O",
            "office_id": "21661267",
            "office_type_code": "SPO",
            "state_name": "Karnataka",
            "delivery_office_flag": false,
            "city_name": "MYSURU",
            "taluk_name": "Mysuru",
            "village_name": "Choose an option",
            "is_rolled_out": true
        },	
        {
            "pincode": 570001,
            "office_name": "Mandimohalla S.O",
            "office_id": "21661273",
            "office_type_code": "SPO",
            "state_name": "Karnataka",
            "delivery_office_flag": false,
            "city_name": "MYSURU",
            "taluk_name": "Mysuru",
            "village_name": "MAISURU",
            "is_rolled_out": true
        },
        {
            "pincode": 570001,
            "office_name": "Mysuru H.O",
            "office_id": "21360043",
            "office_type_code": "HPO",
            "state_name": "Karnataka",
            "delivery_office_flag": true,
            "city_name": "MYSURU",
            "taluk_name": "Mysuru",
            "village_name": "Choose an option",
            "is_rolled_out": true
        }
    ]
	Validations:
	Pincode entered should be a valid number of 6 digit length and is a required field.
	Office-type is post and is a required field.

13.4	Bulk Booking API
This API is used for booking Speed Post, Registered Post, Parcels, and other postal articles. It processes booking details including sender, receiver, weight, dimensions, and optional services such as COD, Insurance, and Acknowledgement.
	
13.4.1 Use this end point if the payload is below 1000 articles.
	APIUrl: https://app.indiapost.gov.in/beextcustomer/process-articles/(customId)
	Authorization: Bearer token
Json Validations:
Field Name	Required Field	Validation	Data Type
bulk_customer_id	Mandatory	Number, Length 10	Int64
contract_id	Mandatory	Number, Length 8	Int64
barcode_no	Optional	Characters 13	Varchar(13)
article_type	Mandatory	SP or BP, Characters 2	Varchar(2)
physical_weight	Mandatory	Number, Length 3,3	Numeric(10,3)
shape_of_article	Mandatory	One of [ROLL, NROL, DOC]	Varchar(20)
length	Mandatory	Number, Max 100	Numeric(10,3)
breadth_diameter	Mandatory	Number, Max 100	Numeric(10,3)
height	Mandatory	Number, Max 100	Numeric(10,3)
priority_flag	Optional	One of [TRUE, FALSE]	Boolean
delivery_instruction	Optional	One of [ND, OD, SD]	Varchar(20)
delivery_slot	Optional	One of [9am-2pm, 2pm-5pm, 5pm-8pm]	Varchar(20)
instruction_rts	Optional	One of [RTS, RTA]	Varchar(20)
sender_name	Mandatory	Characters 80	Varchar(80)
sender_company	Mandatory	Characters 80	Varchar(80)
sender_add_line_1	Mandatory	Characters 80	Varchar(80)
sender_add_line_2	Optional	Characters 80	Varchar(80)
sender_city	Mandatory	Characters 80	Varchar(80)
sender_state	Optional	Characters 80	Varchar(80)
sender_pincode	Mandatory	Number 6	Int4
sender_emailid	Optional	Characters 80	Varchar(80)
sender_alt_contact	Optional	Numbers 10	Int8
sender_kyc	Optional	Characters 20	Varchar(20)
sender_tax_reference	Optional	Characters 20	Varchar(20)
receiver_name	Mandatory	Characters 80	Varchar(80)
receiver_company	Mandatory	Characters 80	Varchar(80)
receiver_add_line_1	Mandatory	Characters 80	Varchar(80)
receiver_add_line_2	Optional	Characters 80	Varchar(80)
receiver_city	Mandatory	Characters 80	Varchar(80)
receiver_state	Optional	Characters 80	Varchar(80)
receiver_pincode	Mandatory	Number 6	Int4
receiver_emailid	Optional	Characters 80	Varchar(80)
receiver_alt_contact	Optional	Numbers 10	Int8
receiver_kyc	Optional	Characters 20	Varchar(20)
receiver_tax_reference	Optional	Characters 20	Varchar(20)
alt_address_flag	Mandatory	One of [TRUE, FALSE]	Boolean
pickup_address_flag	Mandatory	One of [TRUE, FALSE]	Boolean
drop_off_pincode	Mandatory	Number 6	Int4
sender_mobile_no	Mandatory	Numbers 10	Int8
receiver_mobile_no	Mandatory	Numbers 10	Int8
prepayment_code	Optional	One of [PS, FM, SS]	Varchar(15)
value_of_prepayment	Optional	Number, Length 10,2	Numeric(10,2)
codr_cod	Mandatory	One of [COD, CODR, Blank]	Varchar(5)
value_for_codr_cod	Mandatory	Number, Length 10,2	Numeric(10,2)
insurance_type	Optional	One of [DOP]	Varchar(20)
value_of_insurance	Optional	Number, Length 10,2	Numeric(10,2)
ack	Optional	One of [TRUE, FALSE]	Boolean
bulk_reference	Mandatory	Characters 50	Varchar(50)
pickup_address_id	Optional	Number 8	Number
pickup_addressee_name	Mandatory	Characters 80	Varchar(80)
pickup_company_name	Mandatory	Characters 80	Varchar(80)
pickup_address_line1	Mandatory	Characters 80	Varchar(80)
pickup_address_line2	Optional	Characters 80	Varchar(80)
pickup_address_line3	Optional	Characters 80	Varchar(80)
pickup_city	Mandatory	Characters 80	Varchar(80)
pickup_state	Optional	Characters 80	Varchar(80)
pickup_pincode	Mandatory	Number 6	Int4
pickup_email_id	Optional	Characters 80	Varchar(80)
pickup_alt_contact_no	Optional	Numbers 10	Int8
pickup_mobile_no	Mandatory	Numbers 10	Int8
pickup_schedule_slot	Optional	One of [08:00-09:00, ..., 19:00-20:00]	Varchar(20)
pickup_schedule_date	Optional	dd-mm-yyyy	Date
alt_addressee_name	Mandatory	Characters 80	Varchar(80)
alt_company_name	Mandatory	Characters 80	Varchar(80)
alt_address_line1	Mandatory	Characters 80	Varchar(80)
alt_address_line2	Optional	Characters 80	Varchar(80)
alt_address_line3	Optional	Characters 80	Varchar(80)
alt_city	Mandatory	Characters 80	Varchar(80)
alt_state	Optional	Characters 80	Varchar(80)
alt_pincode	Mandatory	Number 6	Int4
alt_email_id	Optional	Characters 80	Varchar(80)
alt_contact_no	Optional	Numbers 10	Int8
alt_alternate_mobile_no	Mandatory	Numbers 10	Int8

	Sample Input and Output:
Sample Input:
{
    "articles": [
        {
            "bulk_customer_id":"1000000444",
            "contract_id":"41441234",
            "barcode_no": "EB468827991IN",
            "pickup_or_dropoff": "dropoff",
            "article_type": "SP",
            "physical_weight": 15,
            "shape_of_article": "",
            "length": "",
            "breadth_diameter": "",
            "height": "",
            "priority_flag": "",
            "delivery_instruction": "",
            "delivery_slot": "",
            "instruction_rts": "",
            "sender_name": "KRA CAMS",
            "sender_company": "",
            "sender_add_line_1": "CHENNAI",
            "sender_add_line_2": "CHENNAI",
            "sender_city": "CHENNAI",
            "sender_state": "TAMIL NADU",
            "sender_pincode": "600001",
            "sender_emailid": "",
            "sender_alt_contact": "",
            "sender_kyc": "",
            "sender_tax_reference": "",
            "receiver_name": "Saurabh Shukla",
            "receiver_company": "",
            "receiver_add_line_1": "NEW DELHI GPO",
            "receiver_add_line_2": "NEW DELHI GPO",
            "receiver_city": "CENTRAL DELHI",
            "receiver_state": "CENTRAL DELHI",
            "receiver_pincode": "110001",
            "receiver_emailid": "",
            "receiver_alt_contact": "",
            "receiver_kyc": "",
            "receiver_tax_reference": "",
            "alt_address_flag": "FALSE",
            "pickup_address_flag": "",
            "drop_off_pincode": "600001",
            "sender_mobile_no": "1234567890",
            "receiver_mobile_no": "1234567890",
            "prepayment_code": "",
            "value_of_prepayment": 0,
            "codr_cod": "",
            "value_for_codr_cod": "",
            "insurance_type": "",
            "value_of_insurance": 0,
            "ack": "FALSE",
            "bulk_reference": "",
            "pickup_address_id": "",
            "pickup_addressee_name": "",
            "pickup_company_name": "",
            "pickup_address_line1": "",
            "pickup_address_line2": "",
            "pickup_address_line3": "",
            "pickup_city": "",
            "pickup_state": "",
            "pickup_pincode": "",
            "pickup_email_id": "",
            "pickup_alt_contact_no": "0",
            "pickup_mobile_no": "0",
            "pickup_schedule_slot": "",
            "pickup_schedule_date": "",
            "alt_addressee_name": "",
            "alt_company_name": "",
            "alt_address_line1": "",
            "alt_address_line2": "",
            "alt_address_line3": "",
            "alt_city": "",
            "alt_state": "",
            "alt_pincode": "",
            "alt_email_id": "",
            "alt_contact_no": "0",
            "alt_alternate_mobile_no": ""
        },
        {
            "bulk_customer_id":"1000000444",
            "contract_id":"41441234",
            "barcode_no": "EB468790992IN",
            "pickup_or_dropoff": "dropoff",
            "article_type": "BP",
            "physical_weight": 15,
            "shape_of_article": "",
            "length": "",
            "breadth_diameter": "",
            "height": "",
            "priority_flag": "",
            "delivery_instruction": "",
            "delivery_slot": "",
            "instruction_rts": "",
            "sender_name": "KRA CAMS",
            "sender_company": "",
            "sender_add_line_1": "CHENNAI",
            "sender_add_line_2": "CHENNAI",
            "sender_city": "CHENNAI",
            "sender_state": "TAMIL NADU",
            "sender_pincode": "600001",
            "sender_emailid": "",
            "sender_alt_contact": "",
            "sender_kyc": "",
            "sender_tax_reference": "",
            "receiver_name": "Varun Malhotra",
            "receiver_company": "",
            "receiver_add_line_1": "NEW DELHI GPO",
            "receiver_add_line_2": "NEW DELHI GPO",
            "receiver_city": "CENTRAL DELHI",
            "receiver_state": "CENTRAL DELHI",
            "receiver_pincode": "110001",
            "receiver_emailid": "",
            "receiver_alt_contact": "",
            "receiver_kyc": "",
            "receiver_tax_reference": "",
            "alt_address_flag": "FALSE",
            "pickup_address_flag": "",
            "drop_off_pincode": "60001",
            "sender_mobile_no": "1234567890",
            "receiver_mobile_no": "1234567890",
            "prepayment_code": "",
            "value_of_prepayment": 0,
            "codr_cod": "",
            "value_for_codr_cod": "",
            "insurance_type": "",
            "value_of_insurance": 0,
            "ack": "FALSE",
            "bulk_reference": "",
            "pickup_address_id": "",
            "pickup_addressee_name": "",
            "pickup_company_name": "",
            "pickup_address_line1": "",
            "pickup_address_line2": "",
            "pickup_address_line3": "",
            "pickup_city": "",
            "pickup_state": "",
            "pickup_pincode": "",
            "pickup_email_id": "",
            "pickup_alt_contact_no": "0",
            "pickup_mobile_no": "0",
            "pickup_schedule_slot": "",
            "pickup_schedule_date": "",
            "alt_addressee_name": "",
            "alt_company_name": "",
            "alt_address_line1": "",
            "alt_address_line2": "",
            "alt_address_line3": "",
            "alt_city": "",
            "alt_state": "",
            "alt_pincode": "",
            "alt_email_id": "",
            "alt_contact_no": "0",
            "alt_alternate_mobile_no": ""
        }	
    ]
}
Sample Output:
{
    "success": true,
    "batch_id": "batch_1000000444_1756664817431",
    "custom_id": "1000000444",
    "mail_booking_dom_id": 386807208610000,
    "correlation_id": "1000000444_386807208610000_1756664817432_906",
    "timestamp": "2025-08-31T18:26:57.432Z",
    "input_method": "json_body",
    "total": 2,
    "processed": 2,
    "valid_articles": [
        {
            "barcode_no": "EB468827991IN",
            "index": 0,
            "timestamp": "2025-08-31T18:26:57.432Z",
            "offset_number": "3506",
            "block_number": 24,
            "calculated_tariff": 17,
            "currency": "INR"
        }
    ],
    "error_articles": [
        {
            "barcode_no": "EB468790992IN",
            "index": 1,
            "timestamp": "2025-08-31T18:26:57.432Z",
            "offset_number": null,
            "block_number": null,
            "errors": [
                "Dropoff pincode must be exactly 6 digits"
            ]
        }
    ],
    "summary": {
        "success_count": 1,
        "error_count": 1,
        "total_tariff_amount": 17
    }
}
	Error responses:
	Error Code: 400 (missing json payload)
{	
    "success": false,
    "message": "Request validation failed",
    "errors": [
        {
            "type": "field",
            "msg": "Articles must be an array with 1 to 100,000 items",
            "path": "articles",
            "location": "body"
        }
    ],
    "timestamp": "2025-09-02T07:37:21.980Z"
}

	Error Code:400 (missing customer Id)
{
    "success": false,
    "message": "Custom ID is required. Use either path parameter (/process-articles/:customId) or query parameter (?customId=xxx)",
    "timestamp": "2025-09-02T07:39:36.959Z"
}
	All the validation error codes/messages
		Incorrect Payload errors (Error Code 400)
	Custom ID is required. Use either path parameter (/process-articles/:customId) or query parameter (?customId=xxx)
	Articles must be an array with 1 to 100,000 items
	Empty articles array provided
	Batch size exceed the max size of payload 100000 items

	Validation error messages (In error_articles)
	Barcode number is required
	Barcode number must be between 5 and 50 characters
	Article type is required
	Article type must be SP (Speed Post) or BP (Business Parcel)
	Physical weight is required
	Physical weight must be a whole number between 1 and 35000 grams
	Pickup or dropoff is required
	Pickup or dropoff must be PICKUP or DROPOFF
	Pickup pincode is required when pickup_or_dropoff is PICKUP
	Pickup addressee name is required when pickup_or_dropoff is PICKUP
	Pickup address line 1 is required when pickup_or_dropoff is PICKUP
	Pickup city is required when pickup_or_dropoff is PICKUP
	Pickup state is required when pickup_or_dropoff is PICKUP
	Pickup mobile number is required when pickup_or_dropoff is PICKUP
	Pickup schedule date is required when pickup_or_dropoff is PICKUP
	Pickup schedule slot is required when pickup_or_dropoff is PICKUP
	Pickup pincode must be exactly 6 digits
	Pickup mobile number must be exactly 10 digits
	Dropoff pincode is required when pickup_or_dropoff is DROPOFF
	Dropoff pincode must be exactly 6 digits
	Sender name is required
	Sender pincode is required
	Sender pincode must be exactly 6 digits
	Receiver name is required
	Receiver pincode is required
	Receiver pincode must be exactly 6 digits
	sender name must be between 3 and 80 characters
	sender company must be between 3 and 80 characters
	sender add line 1 must be between 3 and 80 characters
	sender add line 2 must be between 3 and 80 characters
	sender city must be between 3 and 80 characters
	sender state must be between 3 and 80 characters
	sender emailid must be between 3 and 80 characters
	receiver name must be between 3 and 80 characters
	receiver company must be between 3 and 80 characters
	receiver add line 1 must be between 3 and 80 characters
	receiver add line 2 must be between 3 and 80 characters
	receiver city must be between 3 and 80 characters
	receiver state must be between 3 and 80 characters
	receiver emailid must be between 3 and 80 characters
	pickup addressee name must be between 3 and 80 characters
	pickup company name must be between 3 and 80 characters
	pickup address line1 must be between 3 and 80 characters
	pickup address line2 must be between 3 and 80 characters
	pickup address line3 must be between 3 and 80 characters
	pickup city must be between 3 and 80 characters
	pickup state must be between 3 and 80 characters
	pickup email id must be between 3 and 80 characters
	alt addressee name must be between 3 and 80 characters
	alt company name must be between 3 and 80 characters
	alt address line1 must be between 3 and 80 characters
	alt address line2 must be between 3 and 80 characters
	alt address line3 must be between 3 and 80 characters
	alt city must be between 3 and 80 characters
	alt state must be between 3 and 80 characters
	alt email id must be between 3 and 80 characters

13.4.2	Use this end point for the payload upto 5000 articles.
	APIUrl:https://app.indiapost.gov.in/beextcustomer/process-articles-file/:customId
	Authorization: Bearer token
	Payload type: form-data
	Key: file
	Type: file
	Value: .json file containing up to 5000 articles
	Error responses:
	Error Code:400(missing json payload)
{
    "success": false,
    "message": "No file uploaded. Please upload a JSON file containing articles.",
    "custom_id": "1000000444",
    "timestamp": "2025-09-02T07:42:29.026Z"
}
Payload: JSON file should contain the payload same as the payload for the endpoint https://app.indiapost.gov.in/beextcustomer /process-articles/:customId
o	Booking API processes one or more articles in a single request.
o	Barcode number must be unique for each article.
o	Dimensions and weight must adhere to India Post guidelines.
o	Optional services: COD, Insurance, Acknowledgement, Prepayment.
o	Response includes booking reference and tariff breakup.
13.5	Address Label Generation API
o	This API generates the address label for the given barcode and address details.
o	APIUrl: https://app.indiapost.gov.in/beextcustomer/v1/label/create/domestic
o	Authorization: Bearer token
o	Sample Input and Output:
	Sample Input:
{
    "identifier": "Domestic",
    "delivery_office_name": "Rajkot Sau Uni Area SO",
    "booking_datetime": "27/08/2025, 22:56:04",
    "channel_type": "E",
    "user_type": "R",
    "user_id": 1516467976,
    "barcode_no": "RK169063347IN",
    "service_type": "LETTER",
    "booking_type": "COM",
    "customer_id": 1516467976,
    "article_length": "18",
    "article_breadth": "15",
    "article_height": "3",
    "prepaid_flag": false,
    "prepaid_type": "",
    "prepaid_value": 0,
    "vpcod_type": "CODR",
    "vpcod_value": 9,
    "insurance_flag": true,
    "insurance_value": 100,
    "physical_weight": 50,
    "volumetric_weight": 135,
    "recipient_name": "Uday Gambhaba",
    "recipient_mobile": "8160667733",
    "recipient_addressl1": "A301,Shubh Vatika,Raiya Road",
    "recipient_addressl2": "Samrudhi Park Society",
    "recipient_addressl3": "",
    "recipient_city": "Rajkot",
    "recipient_pin": "360005",
    "recipient_state": "Gujarat",
    "sender_name": "Spiritual Lifestyle Company Lucknow",
    "sender_mobile": "9555107203",
    "sender_addressl1": "5/154 Vikas Khand",
    "sender_addressl2": "Gomti Nagar",
    "sender_addressl3": "",
    "sender_city": "Lucknow",
    "sender_pin": "226010",
    "sender_state": "Uttar Pradesh",
    "transmission_mode": " ",
    "payment_mode": "QR",
    "routing_data": "-RAJKOT",
    "booking_office_name": " ",
    "booking_office_pin": "226010",
    "size": "A7",
    "total_amount": 61,
    "value_added_services": "ND"
}
	Sample Output: PDF file with addresses and barcode and all other details
o	Field Validations
Field Name	Data Type	Field Validation
BookingDatetime	Varchar(50)	Not mandatory
ChannelType	Varchar(2)	Mandatory, oneof = "I" , "E" , "K" , "M"
UserType	Varchar(2)	Mandatory, oneof = "G" , "D" , "A" , "T"
UserID	uint64	Not mandatory
BarcodeNo	Varchar(13)	Mandatory
ServiceType	Varchar(20)	Mandatory
BookingType	Varchar(20)	Mandatory
ArticleLength	Varchar(10)	Mandatory
ArticleBreadth	Varchar(10)	Mandatory
ArticleHeight	Varchar(10)	Mandatory
PrepaidFlag	Bool	Not mandatory
PrepaidType	Varchar(20)	Not mandatory
PrepaidValue	float64	Not mandatory
VpcodType	Varchar(20)	Not mandatory
VpcodValue	float64	Not mandatory
InsuranceFlag	Bool	Not mandatory
InsuranceValue	float64	Not mandatory
PhysicalWeight	float64	Not mandatory
VolumetricWeight	float64	Not mandatory
RecipientName	Varchar(80)	Mandatory
RecipientMobile	Varchar(20)	Not mandatory
RecipientAddressl1	Varchar(80)	Mandatory
RecipientAddressl2	Varchar(80)	Mandatory
RecipientAddressl3	Varchar(80)	Mandatory
RecipientCity	Varchar(80)	Not mandatory
RecipientPin	Varchar(20)	Not mandatory
RecipientState	Varchar(80)	Not mandatory
SenderName	Varchar(80)	Not mandatory
SenderMobile	Varchar(20)	Not mandatory
SenderAddressl1	Varchar(80)	Not mandatory
SenderAddressl2	Varchar(80)	Not mandatory
SenderAddressl3	Varchar(80)	Not mandatory
SenderCity	Varchar(80)	Not mandatory
SenderPin	Varchar(20)	Not mandatory
SenderState	Varchar(80)	Not mandatory

13.6	Event Sharing API
o	This API gives the event data for a specified date for the given customer ID.
o	APIUrl: https://app.indiapost.gov.in/beextcustomer/v1/event/download
o	Authorization: Bearer token
o	Sample Input and Output:
	Sample Input:
		{
   		 "Cust_Id": "0000000000",
  		  "Event_Code": "LE",
  		  "Event_Date": "01052022"
}
	Sample Output:  Event data in XML format
<?xml version="1.0" encoding="utf-8"?><LatestEventDetails>
<ArticleDetails>
<ArticleNumber>EC197432327IN</ArticleNumber>
<ArticleType>SP_INLAND</ArticleType>
<BookingDate>01102021</BookingDate>
<BookingTime>093000</BookingTime>
<BookingOfficeFacilityID>PC21150000650</BookingOfficeFacilityID>
<BookingOfficeName>Parcel Processing Center Bengaluru</BookingOfficeName>
<BookingPIN>560058</BookingPIN>
<SenderAddressCity>BENGALURU</SenderAddressCity>
<DestinationOfficeFacilityID>PO14102219000</DestinationOfficeFacilityID>
<DestinationOfficeName>Kusmunda Colliery SO</DestinationOfficeName>
<DestinationPIN>495454</DestinationPIN>
<DestinationCity>KORBA</DestinationCity>
<DestinationCountry>India</DestinationCountry>
<ReceiverName>MADHU KANWAR</ReceiverName>
<InvoiceNo>SL0243110181633352525</InvoiceNo>
<LineItem>1</LineItem>
<WeightValue>300.000</WeightValue>
<Tariff>80.00</Tariff>
<CODAmount>0.00</CODAmount>
<BookingType>I</BookingType>
<ContractNumber>0040000354</ContractNumber>
<Refrence></Refrence>
<EventCode>ITEM_BOOK</EventCode>
<EventDescription>Item Booked</EventDescription>
<EventOfficeFaciltyID>SP21150000650</EventOfficeFaciltyID>
<EventOfficeName>Bengaluru NSH</EventOfficeName>
<EventDate>01102021</EventDate>
<EventTime>093000</EventTime>
<NonDelReason></NonDelReason>
</ArticleDetails>
<ArticleDetails>
<ArticleNumber>EM295811157IN</ArticleNumber>
<ArticleType>SP_INLAND</ArticleType>
<BookingDate>01102021</BookingDate>
<BookingTime>101500</BookingTime>
<BookingOfficeFacilityID>BN15151000651</BookingOfficeFacilityID>
<BookingOfficeName>BNPL AMPC</BookingOfficeName>
<BookingPIN>110037</BookingPIN>
<SenderAddressCity>SOUTH WEST DELHI</SenderAddressCity>
<DestinationOfficeFacilityID>PO13111105000</DestinationOfficeFacilityID>
<DestinationOfficeName>Bijaipur SO Gopalganj</DestinationOfficeName>
<DestinationPIN>841508</DestinationPIN>
<DestinationCity>Gopalganj</DestinationCity>
<DestinationCountry>India</DestinationCountry>
<ReceiverName></ReceiverName>
<InvoiceNo>SL0243110181633352530</InvoiceNo>
<LineItem>1</LineItem>
<WeightValue>280.000</WeightValue>
<Tariff>80.00</Tariff>
<CODAmount>0.00</CODAmount>
<BookingType>I</BookingType>
<ContractNumber>0040000355</ContractNumber>
<Refrence></Refrence>
<EventCode>ITEM_BOOK</EventCode>
<EventDescription>Item Booked</EventDescription>
<EventOfficeFaciltyID>PO27102105000</EventOfficeFaciltyID>
<EventOfficeName>Basti Jodhewal SO</EventOfficeName>
<EventDate>01102021</EventDate>
<EventTime>101500</EventTime>
<NonDelReason></NonDelReason>
</ArticleDetails>
</LatestEventDetails>

o	Field Validations
Field Name	Data Type	Field Validation
Cust_Id	String	Mandatory(Length=10)
Event_Code	String	Mandatory, one of = "LE" , "IB" , "ID" , "RT"
LE-Last Event
IB-Item Booked
ID-Item Delivered
RT-Returned
Event_Date	String(Date in DDMMYYYY format)	Mandatory


o	Latest Event File Structure:
Tag Name	Description	FORMAT	Length	Mandatory Field
<?xml version="1.0"
encoding="UTF-8"?>				
<LatestEventDetails>				
<ArticleDetails>				
<ArticleNumber>	Article / EMO ID	Characters	20	Yes
<ArticleType>	Article Type	Characters	18	No
<BookingDate>	Booking Date	Date (DDMMYYYY)	8	No
<BookingTime>	Booking Time	Time (HHMMSS)	6	No
<BookingOfficeFacilityID>	Booking Office FacilityID	Characters	13	No
<BookingOfficeName>	Booking Office Name	Characters	50	No
<BookingPIN>	Booking Office PIN	Number	6	No
<SenderAddressCity>	Booking Office City	Characters	50	No
<DestinationOfficeFacilityID>	Destination Office
FacilityId	Characters	13	No
<DestinationOfficeName>	Destination Office Name	Characters	50	No
<DestinationPIN>	Destination Office PIN	Number	6	No
<DestinationCity>	Destination City	Characters	50	No
<DestinationCountry>	Destination Country	Characters	50	No
<ReceiverName>	Receiver Name	Characters	50	No
<InvoiceNo>	Invoice No	Characters	30	No
<LineItem>	Line Item	Number	5	No
<WeightValue>	Weight Value in gms	Number	6	No
<Tariff>	Tariff	Number	5	No
<CODAmount>	COD Amount	Number	8	No
<BookingType>	Booking Type	Characters	3	No
<ContractNumber>	Contract Number	Number	10	No
<Refrence>	Reference Number	Characters	50	No
<EventCode>	Event Code	Characters	20	Yes
<EventDescription>	Event Description	Characters	50	Yes
<EventOfficeFaciltyID>	EventOffice FaciltyID	Characters	13	Yes
<EventOfficeName>	Event Office Name	Characters	50	Yes
<EventDate>	Event Date	Date (DDMMYYYY)	8	Yes
<EventTime>	Event Time	Time (HHMMSS)	6	Yes
<NonDelReason/>	Non Delivery Reason	Characters	30	No
</ArticleDetails>				
</LatestEventDetails>				

o	BookingType field value will be ‘RBC’ – Registered Bulk Customer



13.7	BULK TRACKING API

o	This API gives the tracking data of 50 articles at once.
o	APIUrl:
	https://app.indiapost.gov.in/beextcustomer/v1/tracking/bulk
	Authorization: Bearer token
o	Sample Input and Output:
	Sample Input:
		{
    "bulk": [
        "CK537858073IN",
        "CK537858060IN"
    ]
}
		

Sample Output:  
{
    "status_code": 200,
    "success": true,
    "message": "data retrieved successfully",
    "data": [
        {
            "booking_details": {
                "article_number": "EB126023474IN",
                "booked_at": "Bengaluru  GPO BNPL Centre",
                "booked_on": "2025-08-12T12:23:39.434011Z",
                "origin_pincode": "560001",
                "destination_pincode": "560040",
                "tariff": 17.7,
                "article_type": "SP_INLAND",
                "delivery_location": "Vijayanagar S.O (Bengaluru)",
                "delivery_confirmed_on": "2025-08-13 15:31:52"
            },
            "tracking_details": [
                {
                    "date": "2025-08-12T00:00:00Z",
                    "time": "20:51:17",
                    "office": "Bengaluru  GPO BNPL Centre",
                    "officeid": 21250001,
                    "event": "Item Bagged"
                },
                {
                    "date": "2025-08-12T00:00:00Z",
                    "time": "21:11:16",
                    "office": "Bengaluru  GPO BNPL Centre",
                    "officeid": 21250001,
                    "event": "Item Dispatched"
                },
                {
                    "date": "2025-08-13T00:00:00Z",
                    "time": "04:45:59",
                    "office": "Bengaluru City TMO",
                    "officeid": 21680002,
                    "event": "Item Dispatched"
                },
                {
                    "date": "2025-08-13T00:00:00Z",
                    "time": "08:58:43",
                    "office": "Vijayanagar S.O (Bengaluru)",
                    "officeid": 21660187,
                    "event": "Item Received"
                },
                {
                    "date": "2025-08-13T00:00:00Z",
                    "time": "10:15:29",
                    "office": "Vijayanagar S.O (Bengaluru)",
                    "officeid": 21660187,
                    "event": "Item Invoiced"
                },
                {
                    "date": "2025-08-13T00:00:00Z",
                    "time": "15:31:52",
                    "office": "Vijayanagar S.O (Bengaluru)",
                    "officeid": 21660187,
                    "event": "Item Delivered"
                }
            ],
            "del_status": {
                "del_status": "delivered"
            }
        },
        {
            "booking_details": {
                "article_number": "EB126023770IN",
                "booked_at": "Bengaluru  GPO BNPL Centre",
                "booked_on": "2025-08-12T12:23:39.434011Z",
                "origin_pincode": "560001",
                "destination_pincode": "211003",
                "tariff": 41.31,
                "article_type": "SP_INLAND",
                "delivery_location": "Prayagraj City SO",
                "delivery_confirmed_on": "2025-08-18 16:58:30"
            },
            "tracking_details": [
                {
                    "date": "2025-08-13T00:00:00Z",
                    "time": "12:39:19",
                    "office": "Bengaluru  GPO BNPL Centre",
                    "officeid": 21250001,
                    "event": "Item Bagged"
                },
                {
                    "date": "2025-08-13T00:00:00Z",
                    "time": "13:33:33",
                    "office": "Bengaluru  GPO BNPL Centre",
                    "officeid": 21250001,
                    "event": "Item Dispatched"
                },
                {
                    "date": "2025-08-13T00:00:00Z",
                    "time": "16:47:46",
                    "office": "Bengaluru City TMO",
                    "officeid": 21680002,
                    "event": "Item Dispatched"
                },
                {
                    "date": "2025-08-14T00:00:00Z",
                    "time": "13:37:31",
                    "office": "MA AIRPORT Lucknow",
                    "officeid": 31680039,
                    "event": "Item Dispatched"
                },
                {
                    "date": "2025-08-14T00:00:00Z",
                    "time": "18:12:55",
                    "office": "MA Lucknow RMS",
                    "officeid": 31680042,
                    "event": "Item Dispatched"
                },
                {
                    "date": "2025-08-15T00:00:00Z",
                    "time": "18:21:49",
                    "office": "Pratapgarh TMO",
                    "officeid": 31680014,
                    "event": "Item Dispatched"
                },
                {
                    "date": "2025-08-16T00:00:00Z",
                    "time": "23:03:48",
                    "office": "MA Prayagraj RMS",
                    "officeid": 31680012,
                    "event": "Item Dispatched"
                },
                {
                    "date": "2025-08-17T00:00:00Z",
                    "time": "14:13:28",
                    "office": "Prayagraj NSH",
                    "officeid": 31460002,
                    "event": "Item Received"
                },
                {
                    "date": "2025-08-17T00:00:00Z",
                    "time": "15:50:46",
                    "office": "Prayagraj NSH",
                    "officeid": 31460002,
                    "event": "Item Bagged"
                },
                {
                    "date": "2025-08-17T00:00:00Z",
                    "time": "17:45:41",
                    "office": "Prayagraj NSH",
                    "officeid": 31460002,
                    "event": "Item Dispatched"
                },
                {
                    "date": "2025-08-18T00:00:00Z",
                    "time": "00:59:34",
                    "office": "MA Prayagraj RMS",
                    "officeid": 31680012,
                    "event": "Item Dispatched"
                },
                {
                    "date": "2025-08-18T00:00:00Z",
                    "time": "09:05:37",
                    "office": "Prayagraj City SO",
                    "officeid": 31660540,
                    "event": "Item Received"
                },
                {
                    "date": "2025-08-18T00:00:00Z",
                    "time": "10:16:06",
                    "office": "Prayagraj City SO",
                    "officeid": 31660540,
                    "event": "Item Invoiced"
                },
                {
                    "date": "2025-08-18T00:00:00Z",
                    "time": "16:58:30",
                    "office": "Prayagraj City SO",
                    "officeid": 31660540,
                    "event": "Item Delivered"
                }
            ],
            "del_status": {
                "del_status": "delivered"
            }
        }
    ]
}



13.8	SFTP Integration
13.7.1 Key features:
o	Unique credentials and segregated folder structure per customer
o	Supported formats: CSV, Excel, XML
o	Data is polled, validated, and booked automatically
o	Checksum verification to ensure file integrity
For bulk booking through SFTP, each customer is allocated a **dedicated folder structure** under their Customer ID. This ensures isolation, security, and traceability of files.
13.8.2	Folder Structure:
o	`<CustomerID>/INBOUND` – Customer uploads input files here for processing.
o	`<CustomerID>/OUTBOUND` – System generated bulk tracking event files are placed here.
13.8.3	Process Flow:
o	Customers place their bulk booking file in the **inbound** folder
o	The system continuously monitors this folder. Once a file is detected, it is automatically picked up.
o	The file undergoes validation for format, structure, and business rules (pincode, tariff, mandatory fields).
o	 After validation, the system processes the file for booking:
	Allowed input formats: XLS, XLSX, CSV.
	Checksum verification is performed to ensure file integrity.
o	Once the physical consignments are received at booking office, article booking will happen.
o	Event data flow will start from article booking and bulk tracking event files(XML format) will be   placed in **OUTBOUND** folder.
13.7.4 Additional Features:
o	Unique SFTP credentials are issued to each customer after registration.
o	Customers have access only to their own folders.
o	Full audit logs are maintained for file uploads, processing, and downloads.
o	 This mechanism provides customers with **end-to-end visibility** of booking results and reduces manual intervention.
14	Conclusion
This integration approach empowers customers with secure, flexible, and efficient mechanisms for sharing and retrieving booking/event data, while offering deep operational and analytical insights through advanced reporting, visual dashboards, and real-time monitoring tools.



