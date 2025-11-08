from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image, PageBreak
from reportlab.lib.styles import getSampleStyleSheet

def build_project_summary(path_out="/home/trent/Downloads/fractal power module/E8_Project_Summary.pdf",
                          spectro_image_path="/home/trent/Downloads/fractal power module/download (1).png"):
    doc = SimpleDocTemplate(path_out, pagesize=A4,
                            rightMargin=20*mm, leftMargin=20*mm,
                            topMargin=20*mm, bottomMargin=20*mm)
    styles = getSampleStyleSheet()
    story = []

    story.append(Paragraph("E₈ Fractal Power Module & Spectral Algebraics", styles["Title"]))
    story.append(Spacer(1, 10*mm))
    story.append(Paragraph("Trent Slade / QSOL IMC", styles["Normal"]))
    story.append(Paragraph("Published: 2025-11-08", styles["Normal"]))
    story.append(Spacer(1, 12*mm))

    overview = (
        "This project presents a novel synthesis architecture based on the exceptional Lie algebra E₈, "
        "combined with a qutrit-state control paradigm and golden-ratio (φ) frequency scaling. "
        "The result is the E₈ Fractal Power Module, designed for deep generative audio modulation, "
        "recursive fractal LFO networks and evolving harmonic textures."
    )
    story.append(Paragraph("<b>1. Overview</b><br/>" + overview, styles["BodyText"]))
    story.append(Spacer(1, 8*mm))

    impl = (
        "Control-Layer Code: C++ pseudocode for JUCE integration; Python/NumPy module for research reproducibility.<br/>"
        "Producer.ai Rack Specification: YAML module description with UI mapping, modulation outputs and three tailored presets: “Coxeter Orbit”, “φ-Pulse Grit”, “E8 Pad Swell”.<br/>"
        "Demo Recording & Spectral Analysis: ‘Quantum Drift’ demo audio, spectrograms showing φ-band harmonic clusters, dataset summary CSV and annotated visuals."
    )
    story.append(Paragraph("<b>3. Implementation & Deliverables</b><br/>" + impl, styles["BodyText"]))
    story.append(Spacer(1, 8*mm))

    img = Image(spectro_image_path, width=160*mm, height=90*mm)
    story.append(Paragraph("<b>4. Spectral Analysis Snapshot</b>", styles["Heading2"]))
    story.append(Spacer(1, 4*mm))
    story.append(img)
    story.append(Spacer(1, 8*mm))

    story.append(PageBreak())
    story.append(Paragraph("<b>7. References</b>", styles["Heading2"]))
    story.append(Spacer(1, 4*mm))
    ref = ("Slade, T. (2025). Spectral Algebraics: Audible Geometry via E₈-Inspired Signal Synthesis and 3D Visualization. "
           "Zenodo. https://doi.org/10.5281/zenodo.17557541")
    story.append(Paragraph(ref, styles["Normal"]))

    doc.build(story)

if __name__ == "__main__":
    build_project_summary()
