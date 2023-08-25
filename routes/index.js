var express = require("express");
var router = express.Router();
var { DuffelError } = require("@duffel/api");
var duffel = require("../duffel");

const createClient = require("@sanity/client").default;

var cache = {};

const client = createClient({
  projectId: "6d2pzg6a",
  dataset: "production",
  useCdn: true,
  apiVersion: "2023-08-12", // Use the current date or the specific API version you are developing against.
});

router.get("/airports", async (req, res) => {
  const q = (req.query.q || "").toLowerCase();

  // Check cache first
  if (cache[q]) {
    res.json(cache[q]);
    return;
  }

  try {
    // Query Sanity for both airports and cities that match the search query using case-insensitive regex
    const query = `*[_type in ["airport", "city"] && (name match "${q}*" || city_name match "${q}*" || iata_code match "${q}*")]`;
    console.log(query);
    const results = await client.fetch(query);

    // If there's no result or an empty result, handle accordingly
    if (!results || results.length === 0) {
      res.status(404).json({ error: "No matching results found" });
      return;
    }

    // Store the result in the cache
    cache[q] = results;

    // Send the results as a response
    res.json(results);
  } catch (error) {
    console.error("Error fetching data from Sanity:", error);

    // If it's a specific Sanity error, you can handle that here
    // (assuming there's an identifiable trait or message to the error; this is just an example)
    if (error.message && error.message.includes("Sanity")) {
      res.status(500).send({ error: "Error fetching data from Sanity" });
      return;
    }

    // For all other types of errors
    res.status(500).send({ error: "Server error" });
  }
});

router.get("/airlines", async (req, res) => {
  const q = (req.query.q || "").toLowerCase();

  // Check cache first
  if (cache[q]) {
    res.json(cache[q]);
    return;
  }

  try {
    // Query Sanity for both airports and cities that match the search query using case-insensitive regex
    const query = `*[
      _type in ["airline"] && 
      (name match "${q}*" || frequent_flyer_program.program_name match "${q}*" || iata_code match "${q}*") &&
      defined(frequent_flyer_program.program_name)
    ]`;
    const results = await client.fetch(query);

    // If there's no result or an empty result, handle accordingly
    if (!results || results.length === 0) {
      res.status(404).json({ error: "No matching results found" });
      return;
    }

    // Store the result in the cache
    cache[q] = results;

    // Send the results as a response
    res.json(results);
  } catch (error) {
    console.error("Error fetching data from Sanity:", error);

    // If it's a specific Sanity error, you can handle that here
    // (assuming there's an identifiable trait or message to the error; this is just an example)
    if (error.message && error.message.includes("Sanity")) {
      res.status(500).send({ error: "Error fetching data from Sanity" });
      return;
    }

    // For all other types of errors
    res.status(500).send({ error: "Server error" });
  }
});

router.post("/search", async (req, res) => {
  const { outbound, inbound, cabin_class, passengers, after } = req.body;
  console.log("Request Body:", req.body);

  // Validate the outbound data
  if (
    !outbound ||
    !outbound.origin ||
    !outbound.destination ||
    !outbound.date
  ) {
    res.sendStatus(422);
    return;
  }

  try {
    // Create an array of slices for the outbound and (optional) return journey
    const slices = [
      {
        origin: outbound.origin,
        destination: outbound.destination,
        departure_date: outbound.date,
      },
    ];

    // If there's a return journey, add it to the slices array
    if (inbound && inbound.origin && inbound.destination && inbound.date) {
      slices.push({
        origin: inbound.origin,
        destination: inbound.destination,
        departure_date: inbound.date,
      });
    }

    const offerRequestsResponse = await duffel.offerRequests.create({
      slices: slices,
      cabin_class: cabin_class,
      passengers: passengers,
      return_offers: false,
    });

    // Modify the offers.list parameters to include the after value if present
    const offersListParams = {
      offer_request_id: offerRequestsResponse.data.id,
      limit: 50, // Set the limit to 50 (default)
    };

    if (after) {
      offersListParams.after = after;
    }

    const offersResponse = await duffel.offers.list(offersListParams);

    const results = offersResponse || [];

    res.send({
      results,
    });

    console.log("After:", results.meta.after);
    console.log("Results", results.data.length);
  } catch (e) {
    console.error(e);
    if (e instanceof DuffelError) {
      res.status(e.meta.status).send({ errors: e.errors });
      return;
    }

    res.status(500).send(e);
  }
});

router.get("/book/itinerary/:id", async (req, res) => {
  const offer_id = req.params.id;
  try {
    const response = await duffel.offers.get(offer_id, {
      return_available_services: true,
    });

    console.log(response); // Log the response here

    res.status(200).json(response.data);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).send("Server error");
  }
});

module.exports = router;
