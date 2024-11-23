import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { post } from "../services/api";

const JobForm = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    skills: "",
    experience: "",
    jobPreference: "frontend",
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await post("/submit", formData);
      alert("Data submitted successfully!");
      navigate("/data"); // Redirect to the data display page
    } catch (error) {
      alert(`Error submitting data: ${error.message}`);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ margin: "20px" }}>
      <h2>Job Application Aggregator</h2>
      <label>Name:</label>
      <input
        name="name"
        value={formData.name}
        onChange={handleChange}
        placeholder="Full Name"
        required
      />
      <br />
      <label>Email:</label>
      <input
        type="email"
        name="email"
        value={formData.email}
        onChange={handleChange}
        placeholder="Email"
        required
      />
      <br />
      <label>Skills:</label>
      <input
        name="skills"
        value={formData.skills}
        onChange={handleChange}
        placeholder="Comma-separated skills"
        required
      />
      <br />
      <label>Experience (Years):</label>
      <input
        type="number"
        name="experience"
        value={formData.experience}
        onChange={handleChange}
        placeholder="Years of experience"
        required
      />
      <br />
      <label>Job Preference:</label>
      <select
        name="jobPreference"
        value={formData.jobPreference}
        onChange={handleChange}
        required
      >
        <option value="frontend">Frontend</option>
        <option value="backend">Backend</option>
        <option value="fullstack">Full Stack</option>
      </select>
      <br />
      <button type="submit">Submit</button>
    </form>
  );
};

export default JobForm;
