import {
	ActionFunctionArgs,
	Form,
	Link as ReactRouterLink,
	redirect,
	useActionData,
} from "react-router";
import { z } from "zod";
import { badRequest } from "../services/utils";

// Zod schema for form validation
export const JobFormFieldsSchema = z.object({
	name: z.string().min(1, "Name is required"),
	email: z.string().email("Invalid email address"),
	skills: z.string().min(1, "Skills are required"),
	experience: z
		.number()
		.min(0, "Experience must be a positive number")
		.or(z.string().regex(/^\d+$/, "Experience must be a number")),
	jobPreference: z.enum(["frontend", "backend", "fullstack"], "Select a valid job preference"),
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

export const jobFormAction = async ({ request }: ActionFunctionArgs) => {
	const formData = Object.fromEntries(await request.formData());
	const fields = formData as unknown as JobFormFields;

	const result = JobFormFieldsSchema.safeParse(fields);
	if (!result.success) {
		return badRequest({
			fields,
			errors: result.error.flatten(),
		});
	}

	// Simulate saving data to the backend
	console.log("Form submitted:", fields);
	return redirect("/data"); // Navigate to data display page
};

export default function JobForm() {
	const data = useActionData<ActionData<JobFormFields>>();

	return (
		<div style={{ padding: "20px", maxWidth: "600px", margin: "auto" }}>
			<h1 style={{ fontSize: "24px", marginBottom: "20px" }}>Submit Job Application</h1>
			<Form method="post" style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
				<div style={{ display: "flex", flexDirection: "column" }}>
					<label htmlFor="name" style={{ marginBottom: "5px" }}>Name</label>
					<input
						type="text"
						name="name"
						id="name"
						placeholder="Full Name"
						style={{ padding: "10px", border: "1px solid #ccc", borderRadius: "4px" }}
					/>
					{data?.errors?.fieldErrors?.name && (
						<span style={{ color: "red", fontSize: "12px" }}>
							{data.errors.fieldErrors.name[0]}
						</span>
					)}
				</div>

				<div style={{ display: "flex", flexDirection: "column" }}>
					<label htmlFor="email" style={{ marginBottom: "5px" }}>Email</label>
					<input
						type="email"
						name="email"
						id="email"
						placeholder="Your Email"
						style={{ padding: "10px", border: "1px solid #ccc", borderRadius: "4px" }}
					/>
					{data?.errors?.fieldErrors?.email && (
						<span style={{ color: "red", fontSize: "12px" }}>
							{data.errors.fieldErrors.email[0]}
						</span>
					)}
				</div>

				<div style={{ display: "flex", flexDirection: "column" }}>
					<label htmlFor="skills" style={{ marginBottom: "5px" }}>Skills</label>
					<input
						type="text"
						name="skills"
						id="skills"
						placeholder="Comma-separated skills"
						style={{ padding: "10px", border: "1px solid #ccc", borderRadius: "4px" }}
					/>
					{data?.errors?.fieldErrors?.skills && (
						<span style={{ color: "red", fontSize: "12px" }}>
							{data.errors.fieldErrors.skills[0]}
						</span>
					)}
				</div>

				<div style={{ display: "flex", flexDirection: "column" }}>
					<label htmlFor="experience" style={{ marginBottom: "5px" }}>Experience (Years)</label>
					<input
						type="text"
						name="experience"
						id="experience"
						placeholder="Years of experience"
						style={{ padding: "10px", border: "1px solid #ccc", borderRadius: "4px" }}
					/>
					{data?.errors?.fieldErrors?.experience && (
						<span style={{ color: "red", fontSize: "12px" }}>
							{data.errors.fieldErrors.experience[0]}
						</span>
					)}
				</div>

				<div style={{ display: "flex", flexDirection: "column" }}>
					<label htmlFor="jobPreference" style={{ marginBottom: "5px" }}>Job Preference</label>
					<select
						name="jobPreference"
						id="jobPreference"
						style={{ padding: "10px", border: "1px solid #ccc", borderRadius: "4px" }}
					>
						<option value="">Select job preference</option>
						<option value="frontend">Frontend</option>
						<option value="backend">Backend</option>
						<option value="fullstack">Full Stack</option>
					</select>
					{data?.errors?.fieldErrors?.jobPreference && (
						<span style={{ color: "red", fontSize: "12px" }}>
							{data.errors.fieldErrors.jobPreference[0]}
						</span>
					)}
				</div>

				<button
					type="submit"
					style={{
						padding: "10px",
						backgroundColor: "#007BFF",
						color: "white",
						border: "none",
						borderRadius: "4px",
						cursor: "pointer",
					}}
				>
					Submit
				</button>
			</Form>

			<div style={{ marginTop: "20px" }}>
				<ReactRouterLink to="/data" style={{ textDecoration: "none", color: "#007BFF" }}>
					View Aggregated Data
				</ReactRouterLink>
			</div>
		</div>
	);
}
