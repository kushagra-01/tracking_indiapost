const axios = require("axios");
const fs = require("fs");

async function main() {
  try {
    // =====================================
    // LOGIN
    // =====================================

    const loginResponse = await axios.post(
      "https://app.indiapost.gov.in/beextcustomer/v1/access/login",
      {
        username: "3000064964",
        password: "Viv@k32!",
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    const token = loginResponse.data.data.access_token;

    console.log("\n=======================");
    console.log("LOGIN SUCCESS");
    console.log("=======================\n");

    console.log("TOKEN:\n");
    console.log(token);

    // =====================================
    // TRACKING API
    // =====================================

    const trackingResponse = await axios.post(
      "https://app.indiapost.gov.in/beextcustomer/v1/tracking/bulk",
      {
        bulk: [
          "QM125388535IN",
          "QM125388575IN",
          "QM125388650IN",
          "QM125388456IN",
          "QM125389536IN",
          "QM125387518IN",
          "QM125387597IN",
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("\n=======================");
    console.log("TRACKING RESPONSE");
    console.log("=======================\n");

    console.log(
      JSON.stringify(trackingResponse.data, null, 2)
    );

    // =====================================
    // PDF LABEL GENERATION
    // =====================================
    const labelPayload = {
        recipient_name: "Receiver Test",
        recipient_addressl1: "Connaught Place",
        recipient_addressl2: "New Delhi",
        recipient_city: "New Delhi",
        recipient_state: "Delhi",
        recipient_pincode: "110001",
        recipient_mobile: "8888888888",
      
        sender_name: "Legal OPS",
        sender_addressl1: "Patna",
        sender_addressl2: "Bihar",
        sender_city: "Patna",
        sender_state: "Bihar",
        sender_pincode: "800001",
        sender_mobile: "9999999999",
      
        service_type: "SP",
      
        channel_type: "API",
      
        user_type: "CUSTOMER",
      
        barcode_no: "QM125388535IN",
      
        booking_type: "Prepaid",
      
        transmission_mode: "A",
      
        payment_mode: "CASH",
      
        booking_office_name: "Patna GPO",
      
        booking_office_pin: "800001",
      
        size: "A6",
      
        identifier: "Domestic",
      
        weight: 500
      };

    console.log("\n=======================");
    console.log("GENERATING PDF LABEL");
    console.log("=======================\n");

    const pdfResponse = await axios.post(
      "https://app.indiapost.gov.in/beextcustomer/v1/label/create/domestic",
      labelPayload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        responseType: "arraybuffer",
      }
    );

    // SAVE PDF

    fs.writeFileSync(
      "indiapost_label.pdf",
      pdfResponse.data
    );

    console.log("\n=======================");
    console.log("PDF SAVED SUCCESSFULLY");
    console.log("=======================\n");

    console.log(
      "FILE NAME: indiapost_label.pdf"
    );
  } catch (error) {
    console.log("\n=======================");
    console.log("ERROR RESPONSE");
    console.log("=======================\n");

    try {
      const errorText = Buffer.from(
        error.response.data
      ).toString();

      console.log(errorText);
    } catch (e) {
      console.log(error.message);
    }
  }
}

main();