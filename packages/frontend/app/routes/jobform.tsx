import { Form, Link as ReactRouterLink } from 'react-router';
import { z } from 'zod';

// Zod schema for form validation
export const JobFormFieldsSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  linkedin: z.string().optional(),
  phone: z
    .string()
    .regex(/^[+]{1}(?:[0-9-()/. ]{6,15}[0-9]{1,15})$/, {
      error: 'Invalid phone number',
    }),
  state: z.string().min(1, 'State is required'),
  city: z.string().min(1, 'City is required.'),
  jobInterest: z.enum(['solar', 'software', 'mechanic']),
});

export type JobFormFields = z.infer<typeof JobFormFieldsSchema>;

export type ActionData<T> = {
  fields: T;
  errors?: {
    formErrors: string[];
    fieldErrors: {
      [P in keyof T]?: string[];
    };
  };
  response?: Response;
};

export async function clientAction() {}

export default function JobForm() {
  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: 'auto' }}>
      <h1 style={{ fontSize: '24px', marginBottom: '20px' }}>
        What's your contact information?
      </h1>
      <Form
        method="post"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '15px',
        }}
      >
        {/* Full Name */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label htmlFor="name" style={{ marginBottom: '5px' }}>
            Full Name
          </label>
          <input
            type="text"
            name="name"
            id="name"
            style={{
              padding: '10px',
              border: '1px solid #ccc',
              borderRadius: '4px',
            }}
          />
        </div>

        {/* Email Address */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label htmlFor="email" style={{ marginBottom: '5px' }}>
            Email Address
          </label>
          <input
            type="email"
            name="email"
            id="email"
            style={{
              padding: '10px',
              border: '1px solid #ccc',
              borderRadius: '4px',
            }}
          />
        </div>
        {/* Linkedin */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label htmlFor="email" style={{ marginBottom: '5px' }}>
            Linkedin Profile
          </label>
          <input
            type="linkedin"
            name="linkedin"
            id="linkedin"
            style={{
              padding: '10px',
              border: '1px solid #ccc',
              borderRadius: '4px',
            }}
          />
        </div>

        {/* Phone Number */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label htmlFor="phone" style={{ marginBottom: '5px' }}>
            Phone Number
          </label>
          <input
            type="text"
            name="phone"
            id="phone"
            style={{
              padding: '10px',
              border: '1px solid #ccc',
              borderRadius: '4px',
            }}
          />
        </div>

        {/* State */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label style={{ marginBottom: '5px' }} htmlFor="state">
            State
          </label>
          <select
            name="state"
            id="state"
            style={{
              padding: '10px',
              border: '1px solid #ccc',
              borderRadius: '4px',
            }}
          >
            <option value="" />
            <option value="AL">Alabama</option>
            <option value="AK">Alaska</option>
            <option value="AZ">Arizona</option>
            <option value="AR">Arkansas</option>
            <option value="CA">California</option>
            <option value="CO">Colorado</option>
            <option value="CT">Connecticut</option>
            <option value="DE">Delaware</option>
            <option value="FL">Florida</option>
            <option value="GA">Georgia</option>
            <option value="HI">Hawaii</option>
            <option value="ID">Idaho</option>
            <option value="IL">Illinois</option>
            <option value="IN">Indiana</option>
            <option value="IA">Iowa</option>
            <option value="KS">Kansas</option>
            <option value="KY">Kentucky</option>
            <option value="LA">Louisiana</option>
            <option value="ME">Maine</option>
            <option value="MD">Maryland</option>
            <option value="MA">Massachusetts</option>
            <option value="MI">Michigan</option>
            <option value="MN">Minnesota</option>
            <option value="MS">Mississippi</option>
            <option value="MO">Missouri</option>
            <option value="MT">Montana</option>
            <option value="NE">Nebraska</option>
            <option value="NV">Nevada</option>
            <option value="NH">New Hampshire</option>
            <option value="NJ">New Jersey</option>
            <option value="NM">New Mexico</option>
            <option value="NY">New York</option>
            <option value="NC">North Carolina</option>
            <option value="ND">North Dakota</option>
            <option value="OH">Ohio</option>
            <option value="OK">Oklahoma</option>
            <option value="OR">Oregon</option>
            <option value="PA">Pennsylvania</option>
            <option value="RI">Rhode Island</option>
            <option value="SC">South Carolina</option>
            <option value="SD">South Dakota</option>
            <option value="TN">Tennessee</option>
            <option value="TX">Texas</option>
            <option value="UT">Utah</option>
            <option value="VT">Vermont</option>
            <option value="VA">Virginia</option>
            <option value="WA">Washington</option>
            <option value="WV">West Virginia</option>
            <option value="WI">Wisconsin</option>
            <option value="WY">Wyoming</option>
          </select>
        </div>
        {/* City */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label htmlFor="city" style={{ marginBottom: '5px' }}>
            City
          </label>
          <input
            type="text"
            name="city"
            id="city"
            style={{
              padding: '10px',
              border: '1px solid #ccc',
              borderRadius: '4px',
            }}
          />
        </div>

        {/* Job Preference */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label htmlFor="jobInterest" style={{ marginBottom: '5px' }}>
            Job Interests
          </label>
          <select
            name="jobInterest"
            id="jobInterest"
            style={{
              padding: '10px',
              border: '1px solid #ccc',
              borderRadius: '4px',
            }}
          >
            <option value="" />
            <option value="solar">Solar</option>
            <option value="software">Software Development</option>
            <option value="mechanic">Mechanic</option>
          </select>
        </div>

        {/* Submit Button: Span both columns */}
        <button
          type="submit"
          style={{
            padding: '10px',
            backgroundColor: '#007BFF',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            gridColumn: '1 / -1', // Make the button span both columns
          }}
        >
          Submit
        </button>
      </Form>

      <div style={{ marginTop: '20px' }}>
        <ReactRouterLink
          to="/data"
          style={{ textDecoration: 'none', color: '#007BFF' }}
        >
          View Aggregated Data
        </ReactRouterLink>
      </div>
    </div>
  );
}
