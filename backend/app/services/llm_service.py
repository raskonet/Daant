# backend/app/services/llm_service.py
import json
import os

from app.models.dicom_meta import DicomMeta

# from openai import OpenAI # Uncomment if using actual OpenAI

# OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
# openai_client = None
# if OPENAI_API_KEY:
#     openai_client = OpenAI(api_key=OPENAI_API_KEY)
# else:
#     print("--- LLM SERVICE: OPENAI_API_KEY not set. LLM will be simulated. ---")


async def generate_diagnostic_report(
    image_metadata: DicomMeta,
    # annotations_json will be the list of prediction objects from Roboflow
    # as prepared by the backend (label, confidence, x1,y1,x2,y2)
    # or directly from Roboflow (class, confidence, x,y,width,height)
    # Let's assume it's the parsed BoundingBox model from DetectionResult
    parsed_annotations: list[
        dict
    ],  # Expecting list of dicts from BoundingBox.model_dump()
) -> str:

    pathologies_detected_str_parts = []
    if parsed_annotations:
        for ann in parsed_annotations:
            label = ann.get("label", "Unknown")
            confidence = ann.get("confidence", 0)
            # For location, using x1,y1 as a rough indicator. More sophisticated mapping needed for "upper left molar".
            loc_info = (
                f"(approx. region near x:{ann.get('x1',0):.0f}, y:{ann.get('y1',0):.0f})"
                if "x1" in ann
                else ""
            )
            pathologies_detected_str_parts.append(
                f"{label} (confidence: {confidence:.2f}) {loc_info}"
            )

    detected_pathologies_summary = (
        "; ".join(pathologies_detected_str_parts)
        if pathologies_detected_str_parts
        else "No specific pathologies automatically detected by the model."
    )

    prompt_content = f"""You are a dental radiologist. Based on the image annotations provided below (which include detected pathologies from Roboflow model 'adr/6'), write a concise diagnostic report in clinical language.
Image Information: Patient ID: {image_metadata.patient_id}, Study Date: {image_metadata.study_date}, Modality: {image_metadata.modality}.
Image Dimensions: {image_metadata.columns}x{image_metadata.rows} pixels.
Pixel Spacing: {image_metadata.pixel_spacing[0]:.2f}mm x {image_metadata.pixel_spacing[1]:.2f}mm.

Detected Pathologies:
{detected_pathologies_summary}

Output a brief paragraph (or a few short paragraphs) highlighting:
- Detected pathologies and their characteristics (e.g., size if derivable, count).
- Approximate location based on coordinates, if meaningful (e.g., "region near top-left of image" rather than specific tooth numbers unless the model provides that).
- Clinical advice (optional, e.g., "Further clinical assessment recommended", "Correlate with patient symptoms").
Keep the language professional and suitable for a clinical setting.
"""

    print("--- LLM PROMPT ---")
    print(prompt_content)
    print("--------------------")

    # if openai_client:
    #     try:
    #         chat_completion = openai_client.chat.completions.create(
    #             messages=[
    #                 {"role": "system", "content": "You are an expert dental radiologist interpreting X-ray findings."},
    #                 {"role": "user", "content": prompt_content},
    #             ],
    #             model="gpt-3.5-turbo", # or "gpt-4"
    #             temperature=0.3,
    #         )
    #         report_text = chat_completion.choices[0].message.content
    #         return report_text if report_text else "LLM returned an empty response."
    #     except Exception as e:
    #         print(f"--- LLM SERVICE ERROR: OpenAI API call failed: {e} ---")
    #         return f"Error: Could not generate report from LLM at this time. Details: {e}"
    # else:
    # Simulate LLM response
    simulated_report = "## Dental Radiographic Report (AI Assisted)\n\n"
    simulated_report += f"**Patient ID:** {image_metadata.patient_id}\n"
    simulated_report += f"**Study Date:** {image_metadata.study_date}\n"
    simulated_report += f"**Modality:** {image_metadata.modality}\n\n"
    simulated_report += "**Automated Analysis Findings (Roboflow model: adr/6):**\n"
    if pathologies_detected_str_parts:
        simulated_report += "The automated analysis of the provided radiograph identified the following notable features:\n"
        for part in pathologies_detected_str_parts:
            simulated_report += f"- {part}\n"
        simulated_report += "\nThese findings suggest potential areas of interest that may correspond to common dental pathologies. For example, 'Deep Caries' may indicate significant demineralization approaching the pulp, while 'Periapical Lesion' could signify inflammatory changes around the tooth apex. 'Impacted Tooth' refers to a tooth that has failed to erupt into its normal position.\n"
    else:
        simulated_report += "The automated analysis did not detect any specific pathologies from its predefined classes within the set confidence threshold.\n\n"

    simulated_report += "**Clinical Impression & Advice (Simulated):**\n"
    if pathologies_detected_str_parts:
        simulated_report += "The detected annotations warrant careful clinical correlation. It is advised to review these areas with patient history and direct clinical examination. Further diagnostic imaging (e.g., periapical views, CBCT if complex) may be indicated for comprehensive assessment and treatment planning if symptoms are present or if these findings are confirmed clinically.\n"
    else:
        simulated_report += "While no specific pathologies were highlighted by the AI, this does not preclude the presence of other conditions or early-stage changes. Routine clinical examination and periodic radiographic review remain essential.\n"

    simulated_report += "\n**Disclaimer:** This report is generated with AI assistance and is intended for informational and preliminary review purposes only. It is not a substitute for a comprehensive evaluation by a qualified dental professional. All findings must be clinically correlated."
    return simulated_report
